import { getPath } from "../../lib/util.ts";
import type { SourceKind } from "../types";
import { fetchJson } from "./shared.ts";

export const jsonSource: SourceKind = {
  kind: "json",
  label: "Any data link",
  description: "For tinkerers: pull a value out of any data (JSON) address.",
  icon: "gauge",
  group: "Advanced",
  refreshSec: 300,
  params: [
    { key: "url", label: "Data address", kind: "text", placeholder: "https://…", default: "" },
    {
      key: "path",
      label: "Which value",
      kind: "text",
      hint: 'Step through the data with dots, counting lists from 0 — for example prices.0.amount. Leave empty for the whole answer.',
      placeholder: "Whole answer",
      default: "",
    },
  ],
  fields: [
    { key: "value", label: "Value", type: "text", example: "42" },
    { key: "number", label: "Value as a number", type: "number", example: 42 },
    { key: "updated", label: "Last updated", type: "time", format: { relative: true }, example: "2026-09-19T17:10:00Z" },
  ],
  async load(params) {
    if (!params.url) throw new Error("Add a data address first.");
    const found = getPath(await fetchJson(params.url), params.path ?? "");
    const value = typeof found === "object" && found !== null ? JSON.stringify(found) : String(found ?? "");
    return { value, number: Number(String(value).replace(/[^0-9.\-]/g, "")), updated: new Date().toISOString() };
  },
};
