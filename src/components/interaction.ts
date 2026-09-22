import { createContext, useContext } from "react";

/**
 * What a component can do back to the dashboard when someone uses it: tick a box,
 * type a note, nudge a number, reload its data. Saved into the component's own
 * settings, so it survives a reload like everything else.
 */
export type ParamValue = string | number;

export type ComponentActions = {
  /**
   * Pass a function when the new value depends on the old one — two quick taps on a
   * counter must both count, and a computed value would use whatever was on screen.
   */
  setParam: (widgetId: string, key: string, value: ParamValue | ((prev: ParamValue | undefined) => ParamValue)) => void;
  /**
   * Changes several settings in one go, from the saved values (defaults filled in).
   * Timers need this: pausing moves time from "running since" into "elapsed", and
   * doing that as two separate updates could lose a moment or count it twice.
   */
  patchParams: (widgetId: string, fn: (prev: Record<string, ParamValue>) => Record<string, ParamValue>) => void;
  refreshSource: (sourceId: string) => void;
};

export const ComponentActionsContext = createContext<ComponentActions>({
  setParam: () => {},
  patchParams: () => {},
  refreshSource: () => {},
});

export const useComponentActions = () => useContext(ComponentActionsContext);

/** Checklists live in one string: one item per line, done ones prefixed with "x ". */
export type ChecklistItem = { text: string; done: boolean };

export const parseChecklist = (raw: unknown): ChecklistItem[] =>
  String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/^x\s+/i.test(line) ? { text: line.replace(/^x\s+/i, ""), done: true } : { text: line, done: false }));

export const writeChecklist = (items: ChecklistItem[]) =>
  items.map((i) => (i.done ? `x ${i.text}` : i.text)).join("\n");
