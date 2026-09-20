import { formatDate } from "../lib/util";
import type { FieldType, FormatDef } from "./types";

export const MISSING = "—";

const relativeTime = (date: Date) => {
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  if (mins < 1) return "now";
  const say = (n: number, unit: string) => (diff < 0 ? `${n}${unit} ago` : `in ${n}${unit}`);
  if (mins < 60) return say(mins, " min");
  const hours = Math.round(mins / 60);
  if (hours < 24) return say(hours, " h");
  const days = Math.round(hours / 24);
  if (days < 7) return say(days, days === 1 ? " day" : " days");
  return formatDate(date, "ddd DD MMM");
};

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
};

const applyCase = (text: string, format?: FormatDef) =>
  format?.case === "upper" ? text.toUpperCase() : format?.case === "lower" ? text.toLowerCase() : text;

const clip = (text: string, format?: FormatDef) =>
  format?.maxChars && text.length > format.maxChars ? `${text.slice(0, Math.max(1, format.maxChars - 1)).trimEnd()}…` : text;

/** Turns a raw variable value into the text a component shows. */
export function formatValue(value: unknown, type: FieldType, format?: FormatDef): string {
  if (value === null || value === undefined || value === "") return MISSING;

  if (type === "number") {
    const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.\-]/g, ""));
    if (!Number.isFinite(n)) return MISSING;
    const body = format?.decimals === undefined ? String(Math.round(n * 10) / 10) : n.toFixed(format.decimals);
    return `${format?.prefix ?? ""}${body}${format?.unit ?? ""}`;
  }

  if (type === "time") {
    const date = toDate(value);
    if (!date) return MISSING;
    if (format?.relative) return relativeTime(date);
    return formatDate(date, format?.pattern || "HH:mm");
  }

  if (type === "list") {
    const items = Array.isArray(value) ? value : [];
    return items.length ? `${items.length} items` : MISSING;
  }

  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return clip(applyCase(`${format?.prefix ?? ""}${text}${format?.unit ?? ""}`, format), format);
}

/** Merges a binding's overrides onto the field's own defaults. */
export const mergeFormat = (base?: FormatDef, override?: FormatDef): FormatDef | undefined =>
  base || override ? { ...base, ...override } : undefined;
