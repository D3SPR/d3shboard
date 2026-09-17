import { useState, type ReactNode } from "react";
import { BRIDGE_MCP_URL, BRIDGE_WS_URL } from "../bridge/protocol";
import type { AgentBridge, BridgeStatus } from "../bridge/useAgentBridge";
import { Button, Dialog, Disclosure, Field, Intro, Segmented, Toggle, inputClass } from "./kit";

const STATUS: Record<BridgeStatus, { label: string; color: string; hint: string }> = {
  off: { label: "Not connected", color: "#6b6880", hint: "Enter the pairing code below to connect." },
  connecting: { label: "Connecting…", color: "#ffd166", hint: "Reaching the bridge on this computer." },
  waiting: {
    label: "Waiting for the bridge",
    color: "#ffd166",
    hint: "Couldn't reach it yet. Make sure step 1 is running — this keeps retrying by itself.",
  },
  connected: { label: "Connected", color: "#7cf5c4", hint: "Your AI agent can now read and change this dashboard." },
  rejected: { label: "Couldn't connect", color: "#ff7a7a", hint: "" },
};

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
      <code className="min-w-0 flex-1 overflow-x-auto font-['JetBrains_Mono'] text-[11.5px] leading-relaxed whitespace-pre text-white/85">
        {text}
      </code>
      <Button
        className="shrink-0 px-2 py-1 text-[12px]"
        icon={copied ? "check" : "copy"}
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-[var(--accent-ink)]">
          {n}
        </span>
        <h3 className="text-[14px] font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function AgentDialog({ bridge, onClose }: { bridge: AgentBridge; onClose: () => void }) {
  const { settings, setSettings, status, rejectReason, log, canUndo, undo } = bridge;
  const [client, setClient] = useState<"claude" | "other">("claude");
  const [draftCode, setDraftCode] = useState(settings.code);
  const meta = STATUS[status];

  const connect = () => {
    const code = draftCode.trim().toUpperCase();
    setDraftCode(code);
    setSettings({ code, enabled: true });
  };

  return (
    <Dialog
      title="Connect an AI agent"
      subtitle="Let Claude or another AI assistant build and change this dashboard for you."
      icon="bot"
      onClose={onClose}
      width={540}
    >
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <span className="relative flex h-3 w-3 shrink-0">
          {status === "connected" ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: meta.color }} />
          ) : null}
          <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: meta.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold">{meta.label}</div>
          <div className="text-[12px] text-white/55">{status === "rejected" ? rejectReason : meta.hint}</div>
        </div>
        {settings.enabled ? (
          <Button variant="soft" className="shrink-0" onClick={() => setSettings({ enabled: false })}>
            Disconnect
          </Button>
        ) : null}
      </div>

      <Intro>
        This works through a small helper (a “bridge”) running on your computer. Your agent talks to the bridge, and the bridge
        passes changes to this tab — you'll see them appear live. Nothing goes through the internet.
      </Intro>

      <Step n={1} title="Start the bridge">
        <p className="mb-2 text-[12.5px] text-white/55">In a terminal, inside the d3shboard folder, run:</p>
        <CopyBlock text="npm run mcp" />
        <p className="mt-2 text-[12px] text-white/45">It shows a pairing code. Leave it running while you use your agent.</p>
      </Step>

      <Step n={2} title="Add it to your AI tool">
        <div className="mb-2">
          <Segmented
            size="sm"
            value={client}
            onChange={setClient}
            options={[
              { value: "claude", label: "Claude Code" },
              { value: "other", label: "Other apps" },
            ]}
          />
        </div>
        {client === "claude" ? (
          <>
            <p className="mb-2 text-[12.5px] text-white/55">Run this once in a terminal:</p>
            <CopyBlock text={`claude mcp add --transport http d3shboard ${BRIDGE_MCP_URL}`} />
            <p className="mt-2 text-[12px] text-white/45">Then ask Claude something like “build me a morning dashboard with the weather, news and a clock”.</p>
          </>
        ) : (
          <>
            <p className="mb-2 text-[12.5px] text-white/55">
              For apps that accept an MCP server address (Cursor, VS Code, Windsurf…), add this to their MCP settings:
            </p>
            <CopyBlock text={JSON.stringify({ mcpServers: { d3shboard: { type: "http", url: BRIDGE_MCP_URL } } }, null, 2)} />
            <p className="mt-3 mb-2 text-[12.5px] text-white/55">
              Apps that can only start programs themselves (like Claude Desktop) use this instead — replace the path with where
              d3shboard lives, and skip step 1:
            </p>
            <CopyBlock
              text={JSON.stringify(
                { mcpServers: { d3shboard: { command: "node", args: ["/path/to/d3shboard/mcp/server.ts", "--stdio"] } } },
                null,
                2,
              )}
            />
          </>
        )}
      </Step>

      <Step n={3} title="Pair this tab">
        <Field
          label="Pairing code"
          help="The code proves you're the one who started the bridge, so other websites you visit can't take control of your dashboard."
          stacked
        >
          <div className="flex gap-2">
            <input
              className={`${inputClass} font-['JetBrains_Mono'] tracking-widest uppercase`}
              placeholder="ABCD-2345"
              value={draftCode}
              onChange={(e) => setDraftCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
            />
            <Button variant="primary" className="shrink-0" onClick={connect} disabled={!draftCode.trim()}>
              {settings.enabled && draftCode.trim().toUpperCase() === settings.code ? "Reconnect" : "Connect"}
            </Button>
          </div>
        </Field>
        <p className="text-[12px] text-white/45">This tab remembers the code and reconnects by itself next time.</p>
      </Step>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">What the agent did</h3>
          <Button className="py-1.5 text-[12px]" icon="undo" disabled={!canUndo} onClick={undo}>
            Undo last change
          </Button>
        </div>
        {log.length === 0 ? (
          <p className="text-[12.5px] text-white/40">Nothing yet.</p>
        ) : (
          <ul className="max-h-40 overflow-y-auto rounded-lg border border-white/10">
            {log.map((entry) => (
              <li key={entry.id} className="flex gap-3 border-b border-white/5 px-2.5 py-1.5 text-[12.5px] last:border-0">
                <span className="shrink-0 text-white/35 tabular-nums">
                  {new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={entry.error ? "text-red-300" : "text-white/80"}>{entry.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-2.5 text-[12px] leading-relaxed text-amber-100/80">
        A connected agent can see and change everything on this dashboard, including adding custom code. You can undo its changes
        here, or disconnect at any time.
      </p>

      <Disclosure title="Advanced">
        <Field label="Bridge address" help="Only change this if you started the bridge on a different port (D3SH_BRIDGE_PORT)." stacked>
          <input className={inputClass} value={settings.url} onChange={(e) => setSettings({ url: e.target.value })} />
        </Field>
        {settings.url !== BRIDGE_WS_URL ? (
          <Button className="mb-3" onClick={() => setSettings({ url: BRIDGE_WS_URL })}>
            Reset to default
          </Button>
        ) : null}
        <Field label="Connect automatically" help="Keeps trying to reach the bridge whenever this dashboard is open.">
          <Toggle checked={settings.enabled} onChange={(enabled) => setSettings({ enabled })} label="Connect automatically" />
        </Field>
      </Disclosure>
    </Dialog>
  );
}
