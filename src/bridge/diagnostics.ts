import { definitionFor } from "../components/library";
import type { CompNode } from "../components/types";
import { liveData } from "../data/live";
import { sourceKind } from "../data/registry";
import { getPath } from "../lib/util";
import { BREAKPOINTS, rectFor } from "../lib/board";
import type { BoardDoc, BreakpointKey, Panel, Rect, Widget } from "../lib/types";
import { embedProblems } from "./embedLog";

export type Finding = {
  level: "error" | "warning" | "note";
  widget?: string;
  widgetId?: string;
  screen?: string;
  message: string;
  fix?: string;
};

const SCREEN_NAME: Record<BreakpointKey, string> = { sm: "phone", md: "tablet", lg: "computer" };
const NAME_SCREEN: Record<string, BreakpointKey> = { phone: "sm", tablet: "md", computer: "lg" };

// Without a real window to measure, assume a typical browser height for each device.
const ASSUMED_HEIGHT: Record<BreakpointKey, number> = { sm: 720, md: 950, lg: 780 };

const parseHex = (value: string) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
};

const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const over = (top: { r: number; g: number; b: number; a: number }, bottom: { r: number; g: number; b: number }) => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
});

const contrast = (fg: string, bg: string, behind: string) => {
  const f = parseHex(fg);
  const b = parseHex(bg);
  const page = parseHex(behind) ?? { r: 10, g: 10, b: 18, a: 1 };
  if (!f || !b) return null;
  const card = over(b, page);
  const text = over(f, card);
  const [hi, lo] = [luminance(text), luminance(card)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const el = (widgetId: string) =>
  typeof document === "undefined" ? null : document.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(widgetId)}"]`);

function checkContent(widget: Widget, findings: Finding[]) {
  const cfg = widget.config;
  const text = (key: string) => String(cfg[key] ?? "").trim();
  const add = (level: Finding["level"], message: string, fix?: string) =>
    findings.push({ level, widget: widget.title, widgetId: widget.id, message, fix });

  if (widget.type === "image" && !text("url")) add("error", "has no picture link", "Set config.url to an image address.");
  if (widget.type === "iframe" && !text("url")) add("error", "has no web address", "Set config.url.");
  if (widget.type === "feed" && !text("url")) add("error", "has no feed address", "Set config.url to an RSS feed.");
  if (widget.type === "api") {
    if (!text("url")) add("error", "has no data link", "Set config.url to a JSON endpoint.");
    if (!text("path")) add("warning", "has no value path, so it shows the whole response", "Set config.path, e.g. current.temperature_2m.");
  }
  if (widget.type === "embed") {
    const html = text("html");
    if (!html) add("error", "has no code in it", "Set config.html.");
    else if (!/color-scheme|background\s*:/i.test(html)) {
      add(
        "warning",
        "custom panel doesn't set a colour scheme, so it will render on a white canvas and light text will be invisible",
        "Add html, body { background: transparent; color-scheme: dark; } to its CSS.",
      );
    }
  }
}

const walk = (node: CompNode, visit: (n: CompNode) => void) => {
  visit(node);
  if (node.kind === "stack") node.children.forEach((c) => walk(c, visit));
  if (node.kind === "repeat") walk(node.item, visit);
  if (node.kind === "if") {
    walk(node.then, visit);
    if (node.else) walk(node.else, visit);
  }
};

/** Library components can be checked properly: their data is named, not buried in HTML. */
function checkComponent(widget: Widget, findings: Finding[]) {
  const instance = widget.component;
  if (widget.type !== "component" || !instance) return;
  const add = (level: Finding["level"], message: string, fix?: string) =>
    findings.push({ level, widget: widget.title, widgetId: widget.id, message, fix });

  const def = definitionFor(instance.defId);
  if (!def) {
    add("error", `uses a component design that no longer exists ("${instance.defId}")`, "Delete it and add one from list_components.");
    return;
  }

  const live = liveData();
  const tree = instance.tree ?? def.root;

  for (const need of def.needs) {
    const sourceId = instance.sources[need.key];
    const source = sourceId ? live.sources.find((s) => s.id === sourceId) : null;
    if (!source) {
      add("error", `has no ${need.kind} data attached, so it shows dashes`, `Call add_data_source with kind "${need.kind}", then update_widget's dataSources, or re-add the component.`);
      continue;
    }
    const state = live.states[source.id];
    if (state?.status === "error") {
      add("error", `its ${source.name} data isn't loading: ${state.error}`, "Check the source's settings with list_data_sources.");
    }
  }

  // A repeat over an empty list renders as its "nothing right now" line.
  walk(tree, (node) => {
    if (node.kind !== "repeat") return;
    const sourceId = instance.sources[node.list.bind] ?? node.list.bind;
    const state = live.states[sourceId];
    if (!state?.value) return;
    const list = getPath(state.value, node.list.path);
    if (Array.isArray(list) && list.length === 0) {
      add("note", `its “${node.list.path}” list is empty right now, so it shows its placeholder line`, "Usually fine — check back when there is something on.");
    }
  });

  const missingParams = (def.params ?? []).filter((p) => {
    const value = instance.params[p.key];
    return p.kind === "text" && value !== undefined && String(value).trim() === "";
  });
  for (const p of missingParams) add("warning", `has an empty “${p.label}” setting`, `Set settings.${p.key}.`);
}

/** Sources nothing uses are usually left over from deleted components. */
function checkSources(doc: BoardDoc, findings: Finding[]) {
  const live = liveData();
  const used = new Set(
    doc.panels.flatMap((p) => p.widgets).flatMap((w) => Object.values(w.component?.sources ?? {})),
  );
  for (const source of doc.sources) {
    const kind = sourceKind(source.kind);
    const state = live.states[source.id];
    if (!kind) continue;
    if (state?.status === "error" && used.has(source.id)) continue; // already reported on the component
    if (state?.status === "error") {
      findings.push({ level: "warning", message: `The “${source.name}” data isn't loading: ${state.error}`, fix: "Check its settings with list_data_sources." });
    }
  }
}

function checkLayout(panel: Panel, widget: Widget, bp: BreakpointKey, canvasHeight: number, findings: Finding[]) {
  const rect = rectFor(widget, bp);
  if (rect.hidden) return;
  const screen = SCREEN_NAME[bp];
  const width = BREAKPOINTS.find((b) => b.key === bp)!.width;
  const add = (level: Finding["level"], message: string, fix?: string) =>
    findings.push({ level, widget: widget.title, widgetId: widget.id, screen, message, fix });

  if (rect.x < 0 || rect.y < 0) add("error", "starts off the top or left edge", "Use positive x and y.");
  if (rect.x + rect.w > width + 1)
    add("error", `runs past the right edge (ends at ${Math.round(rect.x + rect.w)}px, screen is ${width}px)`, `Reduce w or x with set_widget_layout on ${screen}.`);
  if (rect.y + rect.h > canvasHeight)
    add("warning", `runs below the fold (ends at ${Math.round(rect.y + rect.h)}px, about ${canvasHeight}px is visible) — the page does not scroll`, `Move it up or make it shorter on ${screen}.`);
  if (rect.w < 80 || rect.h < 60) add("warning", "is smaller than the minimum size", "Give it at least 80×60.");

  for (const other of panel.widgets) {
    if (other.id === widget.id) continue;
    const r2 = rectFor(other, bp);
    if (r2.hidden) continue;
    if (overlaps(rect, r2) && widget.id < other.id) {
      findings.push({
        level: "warning",
        widget: widget.title,
        widgetId: widget.id,
        screen,
        message: `overlaps “${other.title}”`,
        fix: `Move one of them on ${screen}, or hide one there.`,
      });
    }
  }
}

function checkLive(widget: Widget, findings: Finding[]) {
  const node = el(widget.id);
  if (!node) return;
  const add = (level: Finding["level"], message: string, fix?: string) =>
    findings.push({ level, widget: widget.title, widgetId: widget.id, message, fix });

  const content = node.querySelector<HTMLElement>("[data-widget-content]");
  if (content && content.scrollHeight > content.clientHeight + 6) {
    add("warning", "content is taller than the box, so part of it is cut off or needs scrolling", "Make the component taller, show fewer items, or reduce the text size.");
  }
  const shown = (node.innerText || "").trim();
  if (widget.type === "feed" && /Couldn't load this feed/i.test(shown)) {
    add("error", "the feed did not load", "Check the RSS address works in a browser.");
  }
  if (widget.type === "feed" && /^\s*Loading…\s*$/i.test(shown)) add("note", "the feed is still loading", "Run the check again in a few seconds.");
  if (widget.type === "api" && /(^|\s)—(\s|$)/.test(shown)) {
    add("error", "the live value could not be read", "Check the data link allows browser requests (CORS) and that the value path is right.");
  }
  if (widget.type === "image") {
    const img = node.querySelector("img");
    if (img && img.complete && img.naturalWidth === 0) add("error", "the picture did not load", "Check the image link.");
  }
  for (const problem of embedProblems(widget.id)) {
    add("error", `custom code error: ${problem.message}`, "Fix the panel's JavaScript.");
  }
}

export function checkDashboard(doc: BoardDoc, params: { pageId?: string; screen?: string }) {
  const panel = doc.panels.find((p) => p.id === (params.pageId ?? doc.activePanelId)) ?? doc.panels[0];
  const screens: BreakpointKey[] = params.screen
    ? [NAME_SCREEN[params.screen] ?? "lg"]
    : (["lg", "md", "sm"] as BreakpointKey[]);

  const findings: Finding[] = [];
  const onScreen = panel.widgets.some((w) => el(w.id));
  const liveHeight = onScreen ? (document.querySelector("[data-widget-id]")?.parentElement?.clientHeight ?? 0) : 0;

  for (const widget of panel.widgets) {
    checkContent(widget, findings);
    checkComponent(widget, findings);
    const readability = contrastFinding(panel, widget);
    if (readability) findings.push(readability);
    for (const bp of screens) {
      const measured = liveHeight && bp === screens[0] ? liveHeight : 0;
      checkLayout(panel, widget, bp, measured || ASSUMED_HEIGHT[bp], findings);
    }
    if (onScreen) checkLive(widget, findings);
  }

  checkSources(doc, findings);
  if (!panel.widgets.length) findings.push({ level: "note", message: "This page is empty." });

  const rank = { error: 0, warning: 1, note: 2 };
  findings.sort((a, b) => rank[a.level] - rank[b.level]);

  return {
    page: panel.name,
    pageId: panel.id,
    screensChecked: screens.map((s) => SCREEN_NAME[s]),
    liveChecks: onScreen
      ? "yes — this page is on screen, so rendering was inspected too"
      : "no — only the saved layout was checked. Call set_view for this page first to have what actually rendered inspected.",
    counts: {
      errors: findings.filter((f) => f.level === "error").length,
      warnings: findings.filter((f) => f.level === "warning").length,
    },
    findings,
  };
}

function contrastFinding(panel: Panel, widget: Widget): Finding | null {
  const ratio = contrast(widget.style.fg, widget.style.bg, panel.background.color);
  if (ratio === null || ratio >= 3) return null;
  return {
    level: "warning",
    widget: widget.title,
    widgetId: widget.id,
    message: `text is hard to read on its background (contrast ${ratio.toFixed(1)}:1, aim for 4.5:1)`,
    fix: "Change style.fg or style.bg.",
  };
}
