import { randomInt, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer, type WebSocket } from "ws";
import {
  BRIDGE_HOST,
  BRIDGE_PORT,
  BRIDGE_PROTOCOL_VERSION,
  type BridgeMethod,
  type PageToServer,
  type ServerToPage,
} from "../src/bridge/protocol.ts";
import { registerTools } from "./tools.ts";

const STDIO = process.argv.includes("--stdio");
const PORT = Number(process.env.D3SH_BRIDGE_PORT ?? BRIDGE_PORT);
const HERE = dirname(fileURLToPath(import.meta.url));
const CODE_FILE = join(HERE, ".pairing-code");
const EXTRA_ORIGINS = (process.env.D3SH_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// stdout carries the MCP protocol in stdio mode, so all logging goes to stderr.
const log = (...args: unknown[]) => console.error("[d3shboard]", ...args);

function loadPairingCode() {
  if (process.env.D3SH_PAIRING_CODE) return process.env.D3SH_PAIRING_CODE.trim().toUpperCase();
  if (existsSync(CODE_FILE)) {
    const saved = readFileSync(CODE_FILE, "utf8").trim();
    if (saved) return saved;
  }
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join("");
  const code = `${pick(4)}-${pick(4)}`;
  writeFileSync(CODE_FILE, `${code}\n`, { mode: 0o600 });
  return code;
}

const PAIRING_CODE = loadPairingCode();

const codeMatches = (given: string) => {
  const a = Buffer.from(given.trim().toUpperCase());
  const b = Buffer.from(PAIRING_CODE);
  return a.length === b.length && timingSafeEqual(a, b);
};

const LOCAL_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const originAllowed = (origin: string | undefined) => !!origin && (LOCAL_ORIGIN.test(origin) || EXTRA_ORIGINS.includes(origin));

class PageLink {
  socket: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private seq = 0;

  get connected() {
    return this.socket !== null;
  }

  attach(socket: WebSocket) {
    if (this.socket) {
      this.send(this.socket, { type: "replaced" });
      this.socket.close();
    }
    this.socket = socket;
    log("Dashboard connected");
    socket.on("message", (data) => {
      let msg: PageToServer;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (msg.type !== "result") return;
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      this.pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.ok) entry.resolve(msg.result);
      else entry.reject(new Error(msg.error));
    });
    socket.on("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      log("Dashboard disconnected");
      for (const [id, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error("The dashboard tab disconnected before answering."));
        this.pending.delete(id);
      }
    });
  }

  send(socket: WebSocket, msg: ServerToPage) {
    socket.send(JSON.stringify(msg));
  }

  call(method: BridgeMethod, params: Record<string, unknown>) {
    const socket = this.socket;
    if (!socket) return Promise.reject(new Error("not connected"));
    const id = String(++this.seq);
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("The dashboard didn't answer in time. Is the tab still open?"));
      }, 15_000);
      this.pending.set(id, { resolve, reject, timer });
      this.send(socket, { type: "call", id, method, params });
    });
  }
}

const link = new PageLink();
let portProblem: string | null = null;

const errorResult = (text: string): CallToolResult => ({ isError: true, content: [{ type: "text", text }] });

const call = async (method: BridgeMethod, params: Record<string, unknown>): Promise<CallToolResult> => {
  if (portProblem) return errorResult(portProblem);
  if (!link.connected) {
    return errorResult(
      `The d3shboard app isn't connected to this bridge yet. Ask the user to open d3shboard in their browser, press "Agent" in the toolbar, turn on the connection and enter the pairing code ${PAIRING_CODE}. Then try again.`,
    );
  }
  log(`→ ${method}`);
  try {
    const result = await link.call(method, params);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
};

const createMcpServer = () => {
  const server = new McpServer(
    { name: "d3shboard", version: "1.0.0" },
    {
      instructions:
        "Builds and edits the user's d3shboard dashboard live in their browser. Call get_guide once before making changes, and get_dashboard to see what's there.",
    },
  );
  registerTools(server, call);
  return server;
};

const readBody = (req: IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 5_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

const deny = (res: ServerResponse, status: number, message: string) => {
  res.writeHead(status, { "content-type": "text/plain" }).end(message);
};

const httpServer = createServer(async (req, res) => {
  if (!LOCAL_HOSTS.has(req.headers.host ?? "")) return deny(res, 403, "Forbidden host");
  const origin = req.headers.origin;
  if (origin && !originAllowed(origin)) return deny(res, 403, "Forbidden origin");

  const path = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;
  if (path === "/mcp") {
    if (STDIO) return deny(res, 404, "This bridge was started in stdio mode.");
    try {
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      const body = req.method === "POST" ? await readBody(req) : undefined;
      await transport.handleRequest(req, res, body);
    } catch (err) {
      log("MCP request failed:", err);
      if (!res.headersSent) deny(res, 400, "Bad request");
    }
    return;
  }

  res.writeHead(200, { "content-type": "text/plain" }).end(
    `d3shboard agent bridge\nDashboard connected: ${link.connected ? "yes" : "no"}\nMCP endpoint: http://${BRIDGE_HOST}:${PORT}/mcp\n`,
  );
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 5_000_000 });
let failedAttempts = 0;
let lockedUntil = 0;

httpServer.on("upgrade", (req, socket, head) => {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  if (path !== "/bridge" || !LOCAL_HOSTS.has(req.headers.host ?? "") || !originAllowed(req.headers.origin)) {
    log(`Refused a connection from origin ${req.headers.origin ?? "(none)"}`);
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const reject = (reason: string) => {
      ws.send(JSON.stringify({ type: "rejected", reason } satisfies ServerToPage));
      ws.close();
    };
    const helloTimer = setTimeout(() => ws.close(), 5000);
    ws.once("message", (data) => {
      clearTimeout(helloTimer);
      let msg: PageToServer;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return ws.close();
      }
      if (msg.type !== "hello") return ws.close();
      if (Date.now() < lockedUntil) return reject("Too many wrong codes. Wait a minute and try again.");
      if (msg.protocol !== BRIDGE_PROTOCOL_VERSION)
        return reject("The bridge and the app are different versions. Restart the bridge after updating.");
      if (!codeMatches(msg.code ?? "")) {
        failedAttempts += 1;
        if (failedAttempts >= 5) {
          lockedUntil = Date.now() + 60_000;
          failedAttempts = 0;
        }
        log("A dashboard tried to connect with the wrong pairing code");
        return reject("That pairing code doesn't match. Check the code shown where the bridge is running.");
      }
      failedAttempts = 0;
      ws.send(JSON.stringify({ type: "welcome" } satisfies ServerToPage));
      link.attach(ws);
    });
  });
});

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    portProblem = STDIO
      ? `Port ${PORT} is already in use — the bridge is probably already running with "npm run mcp". Connect your agent to http://${BRIDGE_HOST}:${PORT}/mcp instead of launching it with --stdio.`
      : `Port ${PORT} is already in use. Stop the other bridge, or set D3SH_BRIDGE_PORT to a different port (and update the address in d3shboard → Agent → Advanced).`;
    log(portProblem);
    if (!STDIO) process.exit(1);
  } else {
    log("Server error:", err);
  }
});

httpServer.listen(PORT, BRIDGE_HOST, () => {
  const lines = [
    "",
    "  d3shboard agent bridge is running",
    "",
    `  Pairing code:  ${PAIRING_CODE}   (enter this in d3shboard → Agent)`,
  ];
  if (!STDIO) {
    lines.push(
      `  MCP endpoint:  http://${BRIDGE_HOST}:${PORT}/mcp`,
      "",
      "  Add it to Claude Code:",
      `    claude mcp add --transport http d3shboard http://${BRIDGE_HOST}:${PORT}/mcp`,
    );
  }
  console.error(lines.join("\n") + "\n");
});

if (STDIO) {
  await createMcpServer().connect(new StdioServerTransport());
}

const shutdown = () => {
  wss.clients.forEach((c) => c.close());
  httpServer.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
