import type { FormatDef } from "../data/types";
import type { CompNode, Value } from "./types";

type Opts<K extends CompNode["kind"]> = Partial<Omit<Extract<CompNode, { kind: K }>, "kind">>;

/** A variable from one of the component's data slots. */
export const bind = (slot: string, path: string, format?: FormatDef): Value => ({ bind: slot, path, format });

/** A variable of the item currently being repeated. */
export const item = (path: string, format?: FormatDef): Value => ({ bind: "@item", path, format });

/** One of the component's own settings. */
export const param = (key: string): Value => ({ param: key });

export const col = (children: CompNode[], o: Opts<"stack"> = {}): CompNode => ({ kind: "stack", dir: "col", children, ...o });

export const row = (children: CompNode[], o: Opts<"stack"> = {}): CompNode => ({ kind: "stack", dir: "row", children, ...o });

export const text = (value: Value, o: Opts<"text"> = {}): CompNode => ({ kind: "text", value, ...o });

export const icon = (value: Value, o: Opts<"icon"> = {}): CompNode => ({ kind: "icon", value, ...o });

export const image = (value: Value, o: Opts<"image"> = {}): CompNode => ({ kind: "image", value, ...o });

export const bar = (value: Value, o: Opts<"bar"> = {}): CompNode => ({ kind: "bar", value, ...o });

export const repeat = (slot: string, path: string, itemNode: CompNode, o: Opts<"repeat"> = {}): CompNode => ({
  kind: "repeat",
  list: { bind: slot, path },
  item: itemNode,
  ...o,
});

export const when = (value: Value, then: CompNode, o: Opts<"if"> = {}): CompNode => ({ kind: "if", value, then, ...o });

export const field = (param: string, o: Opts<"field"> = {}): CompNode => ({ kind: "field", param, ...o });

export const stepper = (param: string, o: Opts<"stepper"> = {}): CompNode => ({ kind: "stepper", param, ...o });

export const checklist = (param: string, o: Opts<"checklist"> = {}): CompNode => ({ kind: "checklist", param, ...o });

export const button = (
  label: string,
  action: Extract<CompNode, { kind: "button" }>["action"],
  o: Opts<"button"> = {},
): CompNode => ({ kind: "button", label, action, ...o });

export const divider: CompNode = { kind: "divider" };

export const spacer: CompNode = { kind: "spacer" };
