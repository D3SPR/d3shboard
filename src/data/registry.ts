import { uid } from "../lib/board.ts";
import type { DataSource, FieldDef, SourceGroup, SourceKind, SourceParams } from "./types";
import { airQualitySource, marineSource, radarSource, sunMoonSource, tidesSource, weatherAlertsSource } from "./sources/environment.ts";
import { countdownSource, holidaysSource, onThisDaySource } from "./sources/calendar.ts";
import { cryptoSource, currencySource, stocksSource } from "./sources/markets.ts";
import { f1Source, funSource, standingsSource, tvSource } from "./sources/play.ts";
import { apodSource, auroraSource, earthquakeSource, spaceSource } from "./sources/space.ts";
import { githubSource, hackerNewsSource } from "./sources/tech.ts";
import { jsonSource } from "./sources/json.ts";
import { locationSource } from "./sources/location.ts";
import { newsSource } from "./sources/news.ts";
import { sportsSource } from "./sources/sports.ts";
import { timeSource } from "./sources/time.ts";
import { weatherSource } from "./sources/weather.ts";

/** Every kind of data the app can fetch. Components say which kinds they need. */
export const SOURCE_KINDS: SourceKind[] = [
  // Weather & sky
  weatherSource,
  airQualitySource,
  sunMoonSource,
  radarSource,
  weatherAlertsSource,
  tidesSource,
  marineSource,
  // Markets
  stocksSource,
  cryptoSource,
  currencySource,
  // News & web
  newsSource,
  hackerNewsSource,
  githubSource,
  // Sports
  sportsSource,
  standingsSource,
  f1Source,
  // Space & planet
  spaceSource,
  apodSource,
  auroraSource,
  earthquakeSource,
  // Time & personal
  timeSource,
  countdownSource,
  holidaysSource,
  onThisDaySource,
  locationSource,
  // Fun
  tvSource,
  funSource,
  // Advanced
  jsonSource,
];

/** The order groups appear in the Add data list. */
export const SOURCE_GROUPS: SourceGroup[] = [
  "Weather & sky",
  "Markets",
  "News & web",
  "Sports",
  "Space & planet",
  "Time & personal",
  "Fun",
  "Advanced",
];

export const kindsInGroup = (group: SourceGroup) => SOURCE_KINDS.filter((k) => k.group === group);

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
