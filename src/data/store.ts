import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { sourceKind } from "./registry";
import type { DataSource, SourceState } from "./types";

const CACHE_KEY = "d3shboard.data.cache";
const CACHE_MAX_AGE = 24 * 3600_000;

type Cache = Record<string, { value: Record<string, unknown>; at: number }>;

/** Same kind + same settings means the same cached values, even across dashboards. */
const cacheKey = (src: DataSource) => `${src.kind}|${JSON.stringify(src.params ?? {})}`;

const readCache = (): Cache => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const writeCache = (key: string, value: Record<string, unknown>) => {
  try {
    const cache = readCache();
    cache[key] = { value, at: Date.now() };
    for (const [k, entry] of Object.entries(cache)) {
      if (Date.now() - entry.at > CACHE_MAX_AGE) delete cache[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: values still live in memory for this session.
  }
};

export type DataStore = {
  states: Record<string, SourceState>;
  refresh: (id?: string) => void;
};

export const DataContext = createContext<DataStore>({ states: {}, refresh: () => {} });

export const useDataStore = () => useContext(DataContext);

/** Values for one source instance, or null while nothing has loaded yet. */
export const useSourceValue = (id: string) => useDataStore().states[id]?.value ?? null;

/**
 * Fetches every configured source on its own schedule, keeps the last good values
 * during a failed refresh, and paints saved values immediately on a cold load.
 */
export function useDataSources(sources: DataSource[]): DataStore {
  const signature = JSON.stringify(sources.map((s) => [s.id, s.kind, s.params]));
  const [states, setStates] = useState<Record<string, SourceState>>({});
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const list: DataSource[] = JSON.parse(signature).map(([id, kind, params]: [string, string, any]) => ({
      id,
      kind,
      name: "",
      params: params ?? {},
    }));
    const cache = readCache();
    let alive = true;
    const timers: ReturnType<typeof setInterval>[] = [];

    // Seed from the cache so a reload shows real numbers before the network answers.
    setStates((prev) => {
      const next: Record<string, SourceState> = {};
      for (const src of list) {
        const cached = cache[cacheKey(src)];
        next[src.id] = prev[src.id] ?? {
          status: "loading",
          value: cached?.value ?? null,
          error: null,
          fetchedAt: cached?.at ?? 0,
          stale: !!cached,
        };
      }
      return next;
    });

    for (const src of list) {
      const def = sourceKind(src.kind);
      if (!def) continue;
      const load = async () => {
        try {
          const value = await def.load(src.params);
          if (!alive) return;
          if (def.refreshSec > 5) writeCache(cacheKey(src), value);
          setStates((prev) => ({
            ...prev,
            [src.id]: { status: "ok", value, error: null, fetchedAt: Date.now(), stale: false },
          }));
        } catch (e) {
          if (!alive) return;
          const message = e instanceof Error ? e.message : "Couldn't load this.";
          setStates((prev) => ({
            ...prev,
            [src.id]: { ...(prev[src.id] ?? { value: null, fetchedAt: 0, stale: false }), status: "error", error: message },
          }));
        }
      };
      load();
      timers.push(setInterval(load, Math.max(1, def.refreshSec) * 1000));
    }

    return () => {
      alive = false;
      timers.forEach(clearInterval);
    };
  }, [signature, nonce]);

  const refresh = useCallback((id?: string) => {
    if (id) {
      setStates((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: "loading" } } : prev));
    }
    setNonce((n) => n + 1);
  }, []);

  return useMemo(() => ({ states, refresh }), [states, refresh]);
}
