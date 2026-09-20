import type { CSSProperties } from "react";
import { BRAND } from "../brand.ts";
import type { ComponentInstance } from "../components/types";
import type { DataSource } from "../data/types";
import type {
  Background,
  BoardDoc,
  BreakpointKey,
  Panel,
  Rect,
  Widget,
  WidgetStyle,
  WidgetType,
} from "./types";
import { WIDGET_DEFAULTS } from "../widgets/defaults.ts";

export const BREAKPOINTS: { key: BreakpointKey; label: string; width: number }[] = [
  { key: "sm", label: "Phone", width: 390 },
  { key: "md", label: "Tablet", width: 820 },
  { key: "lg", label: "Computer", width: 1440 },
];

export const breakpointFor = (width: number): BreakpointKey =>
  width < 768 ? "sm" : width < 1200 ? "md" : "lg";

export const FONTS = [
  "Space Grotesk",
  "DM Sans",
  "JetBrains Mono",
  "Playfair Display",
  "Bebas Neue",
  "system-ui",
];

const STORAGE_KEY = "dashboard.board.v1";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultStyle = (): WidgetStyle => ({
  bg: "#15131fE6",
  fg: "#efedf7",
  border: "#ffffff1f",
  borderWidth: 1,
  radius: 18,
  padding: 18,
  fontFamily: "inherit",
  fontSize: 16,
  fontWeight: 500,
  letterSpacing: 0,
  align: "center",
  opacity: 1,
  shadow: "soft",
  animation: "none",
  blur: true,
  autoFit: true,
});

// Auto-fit scales content from how it looks at the type's default size, like object-fit: contain.
const AUTO_BASE = { fontSize: 16, padding: 18 };

export const autoFitScale = (w: Widget, rect: Rect) => {
  const ref = WIDGET_DEFAULTS[w.type];
  // Library components carry their own reference size, set when they were placed.
  const baseW = Number(w.config.baseW) || ref.w;
  const baseH = Number(w.config.baseH) || ref.h;
  return Math.max(0, Math.min(rect.w / baseW, rect.h / baseH));
};

export const effectiveStyle = (w: Widget, rect: Rect): WidgetStyle => {
  if (!w.style.autoFit) return w.style;
  const scale = autoFitScale(w, rect);
  return {
    ...w.style,
    fontSize: Math.round(Math.min(400, Math.max(6, AUTO_BASE.fontSize * scale)) * 10) / 10,
    padding: Math.round(Math.min(120, Math.max(2, AUTO_BASE.padding * scale))),
    align: "center",
  };
};

const fitRect = (rect: Rect, bp: BreakpointKey): Rect => {
  const width = BREAKPOINTS.find((b) => b.key === bp)!.width;
  const w = Math.min(rect.w, width - 32);
  return { ...rect, w, x: Math.max(16, Math.min(rect.x, Math.max(16, width - w - 16))) };
};

export const layoutsFrom = (x: number, y: number, w: number, h: number) => {
  const lg: Rect = { x, y, w, h, hidden: false };
  return { sm: fitRect(lg, "sm"), md: fitRect(lg, "md"), lg };
};

export const createWidget = (type: WidgetType, x: number, y: number, z: number): Widget => {
  const def = WIDGET_DEFAULTS[type];
  return {
    id: uid(),
    type,
    title: def.title,
    showTitle: type !== "clock" && type !== "text",
    z,
    locked: false,
    layouts: layoutsFrom(x, y, def.w, def.h),
    style: defaultStyle(),
    config: { ...def.config },
  };
};

export const createComponentWidget = (
  instance: ComponentInstance,
  meta: { name: string; w: number; h: number },
  x: number,
  y: number,
  z: number,
): Widget => ({
  id: uid(),
  type: "component",
  title: meta.name,
  showTitle: false,
  z,
  locked: false,
  layouts: layoutsFrom(x, y, meta.w, meta.h),
  style: defaultStyle(),
  config: { baseW: meta.w, baseH: meta.h },
  component: instance,
});

export const rectFor = (w: Widget, bp: BreakpointKey): Rect =>
  w.layouts?.[bp] ?? w.layouts?.lg ?? { x: 40, y: 40, w: 300, h: 180, hidden: false };

export const defaultBackground = (): Background => ({
  kind: "gradient",
  color: "#0b0a12",
  color2: "#221a3a",
  angle: 145,
  imageUrl: "",
  imageFit: "cover",
  dim: 0,
});

export const createPanel = (name: string): Panel => ({
  id: uid(),
  name,
  snap: true,
  gridSize: 20,
  showGrid: true,
  fontFamily: "Space Grotesk",
  accent: BRAND.accent,
  background: defaultBackground(),
  widgets: [],
  animations: [],
});

const withLayouts = (w: Widget, extra: Partial<Record<BreakpointKey, Rect>>): Widget => ({
  ...w,
  layouts: { ...w.layouts, ...extra },
});

const starterPanel = (): Panel => ({
  ...createPanel("Page 1"),
  widgets: [
    withLayouts(createWidget("clock", 80, 90, 1), {
      sm: { x: 20, y: 40, w: 350, h: 140, hidden: false },
      md: { x: 40, y: 40, w: 340, h: 160, hidden: false },
    }),
    withLayouts(createWidget("text", 440, 90, 2), {
      sm: { x: 20, y: 200, w: 350, h: 150, hidden: false },
      md: { x: 420, y: 40, w: 340, h: 160, hidden: false },
    }),
    withLayouts(createWidget("feed", 80, 300, 3), {
      sm: { x: 20, y: 370, w: 350, h: 320, hidden: false },
      md: { x: 40, y: 240, w: 720, h: 300, hidden: false },
    }),
  ],
});

export const starterDoc = (): BoardDoc => {
  const panel = starterPanel();
  return { version: 5, mode: "edit", panels: [panel], activePanelId: panel.id, automations: [], sources: [] };
};

type Loose = Record<string, any>;

const normalizeWidgets = (widgets: Loose[]): Widget[] =>
  widgets.map((w) => ({
    ...(w as Widget),
    layouts:
      w.layouts && w.layouts.lg
        ? w.layouts
        : layoutsFrom(w.x ?? 40, w.y ?? 40, w.w ?? 300, w.h ?? 180),
    // Saves from before auto-fit existed keep their manual sizing so existing dashboards don't shift.
    style: { ...defaultStyle(), autoFit: false, ...(w.style ?? {}) },
    config: { ...(w.config ?? {}) },
  }));

const normalizePanel = (p: Loose, index: number): Panel => ({
  ...createPanel(`Page ${index + 1}`),
  ...p,
  id: p.id ?? uid(),
  name: p.name ?? `Page ${index + 1}`,
  background: { ...defaultBackground(), ...(p.background ?? {}) },
  widgets: normalizeWidgets(Array.isArray(p.widgets) ? p.widgets : []),
  animations: Array.isArray(p.animations) ? p.animations : [],
});

// Saves from before data sources existed simply have none.
const normalizeSources = (input: unknown): DataSource[] =>
  (Array.isArray(input) ? input : [])
    .filter((s: Loose) => s && typeof s.kind === "string")
    .map((s: Loose) => ({
      id: typeof s.id === "string" ? s.id : uid(),
      kind: s.kind,
      name: typeof s.name === "string" ? s.name : s.kind,
      params: typeof s.params === "object" && s.params ? { ...s.params } : {},
    }));

// Accepts every saved format the app has ever written (flat v1, multi-panel v3, v4).
export function normalizeDoc(input: unknown): BoardDoc {
  const doc = input as Loose;
  if (!doc || typeof doc !== "object") return starterDoc();
  const mode = doc.mode === "display" ? "display" : "edit";
  if (Array.isArray(doc.panels) && doc.panels.length > 0) {
    const panels = doc.panels.map(normalizePanel);
    return {
      version: 5,
      mode,
      panels,
      activePanelId: panels.some((p: Panel) => p.id === doc.activePanelId)
        ? doc.activePanelId
        : panels[0].id,
      automations: Array.isArray(doc.automations) ? doc.automations : [],
      sources: normalizeSources(doc.sources),
    };
  }
  if (Array.isArray(doc.widgets)) {
    const panel = normalizePanel(doc, 0);
    return { version: 5, mode, panels: [panel], activePanelId: panel.id, automations: [], sources: normalizeSources(doc.sources) };
  }
  return starterDoc();
}

export function loadDoc(): BoardDoc {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeDoc(JSON.parse(raw)) : starterDoc();
  } catch {
    return starterDoc();
  }
}

export function saveDoc(doc: BoardDoc) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    // Storage full or blocked (private mode): the session keeps working in memory.
  }
}

// Custom-code widgets are sandboxed in iframes; custom animation code is not, so imports flag it.
export const docHasCustomCode = (doc: BoardDoc) =>
  doc.panels.some((p) =>
    p.animations.some((a) => a.effect.kind === "custom" && (a.effect.js + a.effect.html).trim()),
  );

export const removeWidgetFromPanel = (panel: Panel, widgetId: string): Panel => ({
  ...panel,
  widgets: panel.widgets.filter((w) => w.id !== widgetId),
  animations: panel.animations.filter(
    (a) => a.target.widgetId !== widgetId && !("widgetId" in a.trigger && a.trigger.widgetId === widgetId),
  ),
});

export const clonePanel = (panel: Panel): Panel => {
  const idMap = new Map<string, string>();
  const widgets = panel.widgets.map((w) => {
    const id = uid();
    idMap.set(w.id, id);
    return { ...w, id };
  });
  const remap = (id: string) => idMap.get(id) ?? id;
  const animations = panel.animations.map((a) => {
    const trigger = "widgetId" in a.trigger ? { ...a.trigger, widgetId: remap(a.trigger.widgetId) } : a.trigger;
    return { ...a, id: uid(), trigger, target: { ...a.target, widgetId: remap(a.target.widgetId) } };
  });
  return { ...panel, id: uid(), name: `${panel.name} copy`, widgets, animations };
};

export const shadowCss = (style: WidgetStyle, accent: string) => {
  switch (style.shadow) {
    case "soft":
      return "0 18px 50px -20px rgba(0,0,0,.75)";
    case "hard":
      return "8px 8px 0 rgba(0,0,0,.55)";
    case "glow":
      return `0 0 40px -8px ${accent}`;
    default:
      return "none";
  }
};

export const backgroundCss = (bg: Background): CSSProperties => {
  if (bg.kind === "solid") return { background: bg.color };
  if (bg.kind === "gradient")
    return { background: `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.color2})` };
  return {
    backgroundColor: bg.color,
    backgroundImage: `url(${bg.imageUrl})`,
    backgroundSize: bg.imageFit === "repeat" ? "auto" : bg.imageFit,
    backgroundRepeat: bg.imageFit === "repeat" ? "repeat" : "no-repeat",
    backgroundPosition: "center",
  };
};
