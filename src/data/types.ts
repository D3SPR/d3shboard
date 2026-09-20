import type { IconName } from "../ui/icons";

/** What a variable holds. Components decide how to draw each type. */
export type FieldType = "text" | "number" | "time" | "icon" | "image" | "list";

/** How a value is turned into text. Every key is optional; the field supplies defaults. */
export type FormatDef = {
  decimals?: number;
  unit?: string;
  prefix?: string;
  /** time: date pattern (see formatDate), e.g. "HH:mm". */
  pattern?: string;
  /** time: "in 2 h" / "4 min ago" instead of a clock reading. */
  relative?: boolean;
  case?: "upper" | "lower";
  /** text: cut long values with an ellipsis. */
  maxChars?: number;
};

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  format?: FormatDef;
  /** For type "list": the fields each item has. */
  of?: FieldDef[];
  /** Shown in pickers and previews before real data arrives. */
  example: unknown;
};

export type ParamDef = {
  key: string;
  label: string;
  hint?: string;
  kind: "text" | "number" | "select" | "place";
  options?: { value: string; label: string }[];
  placeholder?: string;
  default: string;
};

export type SourceParams = Record<string, string>;

/** Used to group the "Add data" list once there are dozens of kinds. */
export type SourceGroup =
  | "Weather & sky"
  | "Markets"
  | "News & web"
  | "Sports"
  | "Space & planet"
  | "Time & personal"
  | "Fun"
  | "Advanced";

export type SourceKind = {
  kind: string;
  label: string;
  description: string;
  icon: IconName;
  group: SourceGroup;
  /** Seconds between refreshes. */
  refreshSec: number;
  params: ParamDef[];
  fields: FieldDef[];
  /** Fetches once. Throwing puts the source in its error state; the last good values stay on screen. */
  load: (params: SourceParams) => Promise<Record<string, unknown>>;
};

/** A configured copy of a source kind, saved in the dashboard. */
export type DataSource = {
  id: string;
  kind: string;
  name: string;
  params: SourceParams;
};

export type SourceStatus = "loading" | "ok" | "error";

export type SourceState = {
  status: SourceStatus;
  /** Last values that loaded successfully, so a failed refresh doesn't blank the screen. */
  value: Record<string, unknown> | null;
  error: string | null;
  fetchedAt: number;
  /** True while values came from the saved cache and no live fetch has landed yet. */
  stale: boolean;
};

/** Points at one variable: source instance + path inside its values. */
export type Binding = {
  source: string;
  path: string;
  format?: FormatDef;
};
