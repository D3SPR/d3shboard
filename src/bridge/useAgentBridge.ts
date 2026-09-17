import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardDoc } from "../lib/types";
import { BridgeError, runOperation } from "./operations";
import { BRIDGE_PROTOCOL_VERSION, BRIDGE_WS_URL, type PageToServer, type ServerToPage } from "./protocol";

const SETTINGS_KEY = "d3shboard.agentBridge";
const MAX_HISTORY = 30;

export type BridgeStatus = "off" | "connecting" | "waiting" | "connected" | "rejected";

export type BridgeSettings = { enabled: boolean; code: string; url: string };

export type BridgeLogEntry = { id: number; time: number; text: string; error?: boolean };

const loadSettings = (): BridgeSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return { enabled: !!saved.enabled, code: saved.code ?? "", url: saved.url ?? BRIDGE_WS_URL };
  } catch {
    return { enabled: false, code: "", url: BRIDGE_WS_URL };
  }
};

export function useAgentBridge(doc: BoardDoc, setDoc: (doc: BoardDoc) => void) {
  const [settings, setSettingsState] = useState<BridgeSettings>(loadSettings);
  const [status, setStatus] = useState<BridgeStatus>("off");
  const [rejectReason, setRejectReason] = useState("");
  const [log, setLog] = useState<BridgeLogEntry[]>([]);
  const [historySize, setHistorySize] = useState(0);

  const docRef = useRef(doc);
  docRef.current = doc;
  const history = useRef<BoardDoc[]>([]);
  const logId = useRef(0);

  const setSettings = useCallback((patch: Partial<BridgeSettings>) => {
    setSettingsState((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Settings just won't survive a reload.
      }
      return next;
    });
  }, []);

  const addLog = useCallback((text: string, error = false) => {
    setLog((cur) => [{ id: ++logId.current, time: Date.now(), text, error }, ...cur].slice(0, 50));
  }, []);

  // Apply immediately to the ref so back-to-back agent calls see each other's changes before React re-renders.
  const commit = useCallback(
    (next: BoardDoc) => {
      docRef.current = next;
      setDoc(next);
    },
    [setDoc],
  );

  const undo = useCallback(() => {
    const prev = history.current.pop();
    setHistorySize(history.current.length);
    if (!prev) return false;
    commit(prev);
    addLog("Undid the last agent change");
    return true;
  }, [addLog, commit]);

  useEffect(() => {
    if (!settings.enabled || !settings.code.trim()) {
      setStatus("off");
      return;
    }

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;

    const send = (msg: PageToServer) => socket?.readyState === WebSocket.OPEN && socket.send(JSON.stringify(msg));

    const handleCall = (msg: Extract<ServerToPage, { type: "call" }>) => {
      try {
        if (msg.method === "undo") {
          const undone = undo();
          send({ type: "result", id: msg.id, ok: true, result: { undone, remaining: history.current.length } });
          return;
        }
        const outcome = runOperation(docRef.current, msg.method, msg.params ?? {});
        if (outcome.summary && outcome.doc !== docRef.current) {
          history.current.push(docRef.current);
          if (history.current.length > MAX_HISTORY) history.current.shift();
          setHistorySize(history.current.length);
          commit(outcome.doc);
          addLog(outcome.summary);
        }
        send({ type: "result", id: msg.id, ok: true, result: outcome.result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!(err instanceof BridgeError)) console.error("[d3shboard] agent bridge error", err);
        addLog(`Agent request failed: ${message}`, true);
        send({ type: "result", id: msg.id, ok: false, error: message });
      }
    };

    const connect = () => {
      if (stopped) return;
      setStatus(attempt === 0 ? "connecting" : "waiting");
      try {
        socket = new WebSocket(settings.url);
      } catch {
        scheduleRetry();
        return;
      }
      socket.onopen = () => send({ type: "hello", code: settings.code.trim().toUpperCase(), protocol: BRIDGE_PROTOCOL_VERSION });
      socket.onmessage = (event) => {
        let msg: ServerToPage;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (msg.type === "welcome") {
          attempt = 0;
          setStatus("connected");
          addLog("Agent bridge connected");
        } else if (msg.type === "rejected") {
          stopped = true;
          setRejectReason(msg.reason);
          setStatus("rejected");
        } else if (msg.type === "replaced") {
          stopped = true;
          setRejectReason("Another d3shboard tab connected to the bridge, so this one stepped aside.");
          setStatus("rejected");
        } else if (msg.type === "call") {
          handleCall(msg);
        }
      };
      socket.onclose = () => {
        socket = null;
        if (!stopped) scheduleRetry();
      };
    };

    const scheduleRetry = () => {
      if (stopped) return;
      attempt += 1;
      setStatus("waiting");
      retry = setTimeout(connect, Math.min(10_000, 1000 * attempt));
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [settings.enabled, settings.code, settings.url, addLog, commit, undo]);

  return {
    settings,
    setSettings,
    status,
    rejectReason,
    log,
    canUndo: historySize > 0,
    undo,
  };
}

export type AgentBridge = ReturnType<typeof useAgentBridge>;
