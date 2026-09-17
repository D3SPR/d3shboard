import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDate(date: Date, pattern: string) {
  const h12 = date.getHours() % 12 || 12;
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(2),
    MMMM: MONTH_NAMES[date.getMonth()],
    MMM: MONTH_NAMES[date.getMonth()].slice(0, 3),
    MM: pad(date.getMonth() + 1),
    DDDD: DAY_NAMES[date.getDay()],
    dddd: DAY_NAMES[date.getDay()],
    ddd: DAY_NAMES[date.getDay()].slice(0, 3),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    hh: pad(h12),
    h: String(h12),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    A: date.getHours() < 12 ? "AM" : "PM",
    a: date.getHours() < 12 ? "am" : "pm",
  };
  return pattern.replace(/YYYY|YY|MMMM|MMM|MM|DDDD|dddd|ddd|DD|HH|hh|h|mm|ss|A|a/g, (t) => tokens[t] ?? t);
}

export function getPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) return acc[Number(key)];
    if (typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, value);
}

export function listLeafPaths(value: unknown, limit = 300) {
  const out: { path: string; value: string }[] = [];
  const walk = (v: unknown, path: string) => {
    if (out.length >= limit) return;
    if (v !== null && typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        walk(child, path ? `${path}.${k}` : k);
      }
    } else {
      out.push({ path, value: String(v) });
    }
  };
  walk(value, "");
  return out;
}

export function useTick(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export const WIDGET_DATA_EVENT = "d3sh:widget-data";

export const emitWidgetData = (widgetId: string) =>
  window.dispatchEvent(new CustomEvent(WIDGET_DATA_EVENT, { detail: { widgetId } }));
