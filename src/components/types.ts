import type { FormatDef } from "../data/types";
import type { IconName } from "../ui/icons";

/** Text sizes are multiples of the card's own font size, so auto-fit keeps working. */
export type SizeToken = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

/** Colours are roles, so a theme can restyle every component at once. */
export type ColorRole = "text" | "muted" | "accent" | "positive" | "negative";

export type Align = "start" | "center" | "end" | "between";

/**
 * Anything a component shows: fixed text, a variable from one of its data
 * sources, or one of its own settings.
 *  - `bind` names a slot from the definition's `needs`, or "@item" inside a repeat.
 */
export type Value =
  | string
  | { bind: string; path: string; format?: FormatDef }
  | { param: string };

export type CompNode =
  | {
      kind: "stack";
      dir: "row" | "col";
      gap?: number;
      align?: Align;
      justify?: Align;
      grow?: boolean;
      wrap?: boolean;
      pad?: number;
      bg?: string;
      radius?: number;
      children: CompNode[];
    }
  | {
      kind: "text";
      value: Value;
      size?: SizeToken;
      weight?: number;
      color?: ColorRole;
      opacity?: number;
      caps?: boolean;
      lines?: number;
      grow?: boolean;
    }
  | { kind: "icon"; value: Value; size?: SizeToken; color?: ColorRole }
  | { kind: "image"; value: Value; size?: number; radius?: number; fit?: "cover" | "contain"; grow?: boolean }
  | { kind: "bar"; value: Value; max?: Value; color?: ColorRole }
  | { kind: "divider" }
  | { kind: "spacer" }
  | {
      kind: "repeat";
      list: { bind: string; path: string };
      limit?: Value;
      gap?: number;
      dir?: "row" | "col";
      scroll?: boolean;
      item: CompNode;
      empty?: string;
    }
  | { kind: "if"; value: Value; is?: string; not?: string; then: CompNode; else?: CompNode };

export type ComponentParam = {
  key: string;
  label: string;
  hint?: string;
  kind: "number" | "text" | "select" | "toggle";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  default: string | number;
};

/** A slot the component fills with one of the dashboard's data sources. */
export type ComponentNeed = {
  key: string;
  kind: string;
  label: string;
};

export type ComponentCategory = "Time" | "Weather" | "News" | "Sports" | "Numbers" | "Text & shapes";

export type ComponentDef = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  category: ComponentCategory;
  size: { w: number; h: number };
  needs: ComponentNeed[];
  params?: ComponentParam[];
  root: CompNode;
};

/** What a placed component stores: which sources fill its slots, plus its settings. */
export type ComponentInstance = {
  defId: string;
  /** need key → data source id. */
  sources: Record<string, string>;
  params: Record<string, string | number>;
  /** Set once the design has been edited, which detaches it from the library. */
  tree?: CompNode;
};
