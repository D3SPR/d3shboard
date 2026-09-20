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

/**
 * A piece placed freely on the component's own little canvas. Positions are
 * fractions of the component box, so everything scales with it.
 */
export type CanvasItem = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** How the piece sits inside its own box. */
  align?: Align;
  node: CompNode;
};

export type CompNode =
  | { kind: "canvas"; items: CanvasItem[] }
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
      /** Exact size, as a multiple of the component's text size. Wins over `size`. */
      scale?: number;
      weight?: number;
      color?: ColorRole;
      /** A colour of this piece's own, overriding the role and the component's. */
      tint?: string;
      /** A font of this piece's own, overriding the component's. */
      font?: string;
      opacity?: number;
      caps?: boolean;
      lines?: number;
      grow?: boolean;
    }
  | { kind: "icon"; value: Value; size?: SizeToken; scale?: number; color?: ColorRole; tint?: string }
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
  | { kind: "if"; value: Value; is?: string; not?: string; then: CompNode; else?: CompNode }
  /** Typed into by the viewer, saved straight back into the component's settings. */
  | {
      kind: "field";
      param: string;
      placeholder?: string;
      size?: SizeToken;
      weight?: number;
      color?: ColorRole;
      multiline?: boolean;
      grow?: boolean;
    }
  /** A number with − and + beside it, for setting a value by hand. */
  | {
      kind: "stepper";
      param: string;
      step?: number;
      /** Takes the step size from one of the component's settings instead. */
      stepParam?: string;
      min?: number;
      max?: number;
      size?: SizeToken;
      unit?: string;
    }
  /** A tick list the viewer can check off and add to. */
  | { kind: "checklist"; param: string; limit?: number; placeholder?: string; size?: SizeToken }
  /** Does something when tapped: fetch the data again, or change a setting. */
  | {
      kind: "button";
      label: string;
      icon?: IconName;
      action: "refresh" | "set" | "add";
      /** For "set" and "add": which setting to change, and by how much. */
      param?: string;
      amount?: number;
      to?: string;
      /** For "refresh": which data slot to reload. Defaults to the first one. */
      slot?: string;
    };

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
  /** Optional slots aren't set up automatically — the component works without them. */
  optional?: boolean;
};

export type ComponentCategory =
  | "Time"
  | "Weather"
  | "News"
  | "Sports"
  | "Markets"
  | "Space"
  | "Fun"
  | "Numbers"
  | "Text & shapes";

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

/** A design the user saved, ready to place again. Slots are remapped to real sources on placing. */
export type SavedComponent = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  baseDefId: string;
  size: { w: number; h: number };
  slots: { key: string; kind: string }[];
  params: Record<string, string | number>;
  tree: CompNode;
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
