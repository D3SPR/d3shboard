import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRIDGE_PORT } from "../src/bridge/protocol.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// In a checkout the pairing code and settings live beside the server; the standalone bundle keeps them in the user's config dir.
export const STATE_DIR = existsSync(join(HERE, "tools.ts")) ? HERE : join(homedir(), ".config", "d3shboard");
export const CONFIG_FILE = join(STATE_DIR, "bridge.json");

export const ensureStateDir = () => {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
  } catch {
    // Falls back to erroring on write, which is reported where it happens.
  }
};

export type BridgeConfig = {
  port: number;
  /** Extra page origins allowed to connect, on top of localhost. Supports "https://*.example.com". */
  allowedOrigins: string[];
  /** Extra Host headers accepted, for reaching the bridge through a tunnel. */
  allowedHosts: string[];
  anyOrigin: boolean;
  stdio: boolean;
};

type Stored = Pick<BridgeConfig, "allowedOrigins" | "allowedHosts">;

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const flagValues = (argv: string[], name: string) => {
  const found: string[] = [];
  argv.forEach((arg, i) => {
    if (arg === `--${name}`) found.push(...list(argv[i + 1]));
    else if (arg.startsWith(`--${name}=`)) found.push(...list(arg.slice(name.length + 3)));
  });
  return found;
};

export const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, "").toLowerCase();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Patterns are exact strings, or may use "*" for one label, e.g. https://*.example.com
export const matchesPattern = (value: string, pattern: string) => {
  const p = normalizeOrigin(pattern);
  const v = normalizeOrigin(value);
  if (p === v) return true;
  if (!p.includes("*")) return false;
  return new RegExp(`^${p.split("*").map(escapeRegExp).join("[^/.]*")}$`).test(v);
};

const readStored = (): Stored => {
  try {
    if (!existsSync(CONFIG_FILE)) return { allowedOrigins: [], allowedHosts: [] };
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    return {
      allowedOrigins: Array.isArray(parsed.allowedOrigins) ? parsed.allowedOrigins : [],
      allowedHosts: Array.isArray(parsed.allowedHosts) ? parsed.allowedHosts : [],
    };
  } catch {
    return { allowedOrigins: [], allowedHosts: [] };
  }
};

const writeStored = (stored: Stored) => {
  try {
    ensureStateDir();
    writeFileSync(CONFIG_FILE, `${JSON.stringify(stored, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
};

export function loadConfig(argv: string[] = process.argv.slice(2)) {
  const forget = argv.includes("--forget-origins");
  const stored = forget ? { allowedOrigins: [], allowedHosts: [] } : readStored();

  const fromInput = {
    allowedOrigins: [...list(process.env.D3SH_ALLOWED_ORIGINS), ...flagValues(argv, "allow-origin")].map(normalizeOrigin),
    allowedHosts: [...list(process.env.D3SH_ALLOWED_HOSTS), ...flagValues(argv, "allow-host")].map((h) => h.trim().toLowerCase()),
  };

  const merged: Stored = {
    allowedOrigins: [...new Set([...(stored.allowedOrigins ?? []).map(normalizeOrigin), ...fromInput.allowedOrigins])],
    allowedHosts: [...new Set([...(stored.allowedHosts ?? []), ...fromInput.allowedHosts])],
  };

  // Remember what was passed in so the next run works without flags.
  const added = [
    ...fromInput.allowedOrigins.filter((o) => !(stored.allowedOrigins ?? []).map(normalizeOrigin).includes(o)),
    ...fromInput.allowedHosts.filter((h) => !(stored.allowedHosts ?? []).includes(h)),
  ];
  const persisted = (added.length > 0 || forget) && writeStored(merged);

  const portFlag = flagValues(argv, "port")[0];
  const config: BridgeConfig = {
    port: Number(portFlag ?? process.env.D3SH_BRIDGE_PORT ?? BRIDGE_PORT),
    allowedOrigins: merged.allowedOrigins,
    allowedHosts: merged.allowedHosts,
    anyOrigin: argv.includes("--any-origin"),
    stdio: argv.includes("--stdio"),
  };

  return { config, added, persisted, forgot: forget };
}
