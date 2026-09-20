import { getPath } from "../lib/util";
import { MISSING, formatValue, mergeFormat } from "./format";
import { fieldAt, sourceKind } from "./registry";
import type { Binding, DataSource, FieldType, SourceState } from "./types";

export type Resolved = {
  /** The value itself — a number, text, ISO time, icon name, image URL or list. */
  raw: unknown;
  type: FieldType;
  /** The value as a component would show it. */
  text: string;
  missing: boolean;
};

const EMPTY: Resolved = { raw: null, type: "text", text: MISSING, missing: true };

export function resolveBinding(
  states: Record<string, SourceState>,
  sources: DataSource[],
  binding: Binding | null | undefined,
): Resolved {
  if (!binding?.source) return EMPTY;
  const src = sources.find((s) => s.id === binding.source);
  const kind = src && sourceKind(src.kind);
  if (!src || !kind) return EMPTY;
  const field = fieldAt(kind, binding.path);
  const type = field?.type ?? "text";
  const raw = getPath(states[src.id]?.value ?? null, binding.path);
  const missing = raw === null || raw === undefined || raw === "";
  return { raw, type, text: formatValue(raw, type, mergeFormat(field?.format, binding.format)), missing };
}

/** Replaces {{sourceId.path}} tokens inside free text. */
export function fillTokens(
  text: string,
  states: Record<string, SourceState>,
  sources: DataSource[],
): string {
  if (!text.includes("{{")) return text;
  return text.replace(/\{\{\s*([\w-]+)\.([\w.\[\]]+)\s*\}\}/g, (_, source: string, path: string) =>
    resolveBinding(states, sources, { source, path }).text,
  );
}

export type Variable = {
  sourceId: string;
  sourceName: string;
  kind: string;
  path: string;
  label: string;
  type: FieldType;
  hint?: string;
  example: unknown;
  /** True for the fields of an item inside a list. */
  inList: boolean;
};

/** Every variable the user can bind right now, for pickers and the variable browser. */
export function listVariables(sources: DataSource[]): Variable[] {
  const out: Variable[] = [];
  for (const src of sources) {
    const kind = sourceKind(src.kind);
    if (!kind) continue;
    for (const field of kind.fields) {
      out.push({
        sourceId: src.id,
        sourceName: src.name || kind.label,
        kind: src.kind,
        path: field.key,
        label: field.label,
        type: field.type,
        hint: field.hint,
        example: field.example,
        inList: false,
      });
      for (const item of field.of ?? []) {
        out.push({
          sourceId: src.id,
          sourceName: src.name || kind.label,
          kind: src.kind,
          path: `${field.key}.0.${item.key}`,
          label: `${field.label} → first → ${item.label}`,
          type: item.type,
          hint: item.hint,
          example: item.example,
          inList: true,
        });
      }
    }
  }
  return out;
}
