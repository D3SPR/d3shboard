import { useEffect, useMemo, useRef, useState } from "react";
import type { Action, Background, BoardDoc, Condition } from "../lib/types";
import { getPath } from "../lib/util";

export type AutomationEffects = {
  panelId?: string;
  accent?: string;
  fontFamily?: string;
  background?: Background;
  widgetVisible: Record<string, boolean>;
  activeIds: string[];
};

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return Number(h ?? 0) * 60 + Number(m ?? 0);
};

type DataCache = Record<string, unknown>;

const CHECKS: { [K in Condition["kind"]]: (c: Extract<Condition, { kind: K }>, now: Date, data: DataCache) => boolean } = {
  timeRange: (c, now) => {
    const cur = now.getHours() * 60 + now.getMinutes();
    const from = minutes(c.from || "00:00");
    const to = minutes(c.to || "23:59");
    return from <= to ? cur >= from && cur <= to : cur >= from || cur <= to;
  },
  weekday: (c, now) => c.days.includes(now.getDay()),
  monthday: (c, now) => c.days.includes(now.getDate()),
  month: (c, now) => c.months.includes(now.getMonth() + 1),
  dataValue: (c, _now, data) => {
    if (!c.url) return false;
    const found = getPath(data[c.url], c.path);
    if (found == null) return false;
    const text = typeof found === "object" ? JSON.stringify(found) : String(found);
    const a = Number(text);
    const b = Number(c.value);
    switch (c.op) {
      case "is":
        return text.toLowerCase() === c.value.toLowerCase();
      case "isNot":
        return text.toLowerCase() !== c.value.toLowerCase();
      case "contains":
        return text.toLowerCase().includes(c.value.toLowerCase());
      case "gt":
        return Number.isFinite(a) && Number.isFinite(b) && a > b;
      case "lt":
        return Number.isFinite(a) && Number.isFinite(b) && a < b;
      default:
        return false;
    }
  },
};

const check = (c: Condition, now: Date, data: DataCache) =>
  (CHECKS[c.kind] as (c: Condition, now: Date, data: DataCache) => boolean)?.(c, now, data) ?? false;

const apply = (fx: AutomationEffects, action: Action) => {
  switch (action.kind) {
    case "setPanel":
      fx.panelId = action.panelId;
      break;
    case "setAccent":
      fx.accent = action.color;
      break;
    case "setFont":
      fx.fontFamily = action.fontFamily;
      break;
    case "setBackground":
      fx.background = action.background;
      break;
    case "setWidgetVisible":
      fx.widgetVisible[action.widgetId] = action.visible;
  }
};

function evaluate(doc: BoardDoc, now: Date, data: DataCache): AutomationEffects {
  const fx: AutomationEffects = { widgetVisible: {}, activeIds: [] };
  for (const rule of doc.automations) {
    if (rule.enabled && rule.conditions.length > 0 && rule.conditions.every((c) => check(c, now, data))) {
      fx.activeIds.push(rule.id);
      rule.actions.forEach((a) => apply(fx, a));
    }
  }
  return fx;
}

const EMPTY: AutomationEffects = { widgetVisible: {}, activeIds: [] };

export function useAutomations(doc: BoardDoc): AutomationEffects {
  const [now, setNow] = useState<Date | null>(null);
  const [data, setData] = useState<DataCache>({});
  const dataRef = useRef(data);
  dataRef.current = data;

  const urls = useMemo(() => {
    const set = new Set<string>();
    for (const rule of doc.automations) {
      if (!rule.enabled) continue;
      for (const c of rule.conditions) if (c.kind === "dataValue" && c.url) set.add(c.url);
    }
    return [...set];
  }, [doc]);
  const urlKey = urls.join("|");

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!urls.length) return;
    let alive = true;
    const load = async () => {
      const next = { ...dataRef.current };
      await Promise.all(
        urls.map(async (url) => {
          try {
            next[url] = await (await fetch(url)).json();
          } catch {
            // Keep the last good value for this URL.
          }
        }),
      );
      if (alive) setData(next);
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [urlKey]);

  return useMemo(() => (now ? evaluate(doc, now, data) : EMPTY), [doc, now, data]);
}
