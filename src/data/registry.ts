import { uid } from "../lib/board";
import type { DataSource, FieldDef, SourceKind, SourceParams } from "./types";
import { jsonSource } from "./sources/json";
import { locationSource } from "./sources/location";
import { newsSource } from "./sources/news";
import { sportsSource } from "./sources/sports";
import { timeSource } from "./sources/time";
import { weatherSource } from "./sources/weather";

/** Every kind of data the app can fetch. Components say which kinds they need. */
export const SOURCE_KINDS: SourceKind[] = [
  timeSource,
  weatherSource,
  newsSource,
  sportsSource,
  locationSource,
  jsonSource,
];

export const sourceKind = (kind: string) => SOURCE_KINDS.find((k) => k.kind === kind);

export const defaultParams = (kind: SourceKind): SourceParams =>
  Object.fromEntries(kind.params.map((p) => [p.key, p.default]));

export const createSource = (kind: string, params?: SourceParams): DataSource | null => {
  const def = sourceKind(kind);
  if (!def) return null;
  return { id: uid(), kind, name: def.label, params: { ...defaultParams(def), ...params } };
};

/** Finds the field definition a path points at, stepping into list items. */
export function fieldAt(kind: SourceKind, path: string): FieldDef | null {
  let fields: FieldDef[] = kind.fields;
  let found: FieldDef | null = null;
  for (const step of path.split(".")) {
    if (/^\d+$/.test(step)) continue; // list index: stay on the item's fields
    const next: FieldDef | undefined = fields.find((f) => f.key === step);
    if (!next) return null;
    found = next;
    fields = next.of ?? [];
  }
  return found;
}
