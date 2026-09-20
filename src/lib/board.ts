import type { CSSProperties } from "react";
import { BRAND } from "../brand.ts";
import type { ComponentInstance } from "../components/types";
import type { DataSource } from "../data/types";
import type {
  Background,
  Screen,
  BoardDoc,
  BreakpointKey,
  Panel,
  Rect,
  Widget,
  WidgetStyle,
  WidgetType,
} from "./types";
import { WIDGET_DEFAULTS } from "../widgets/defaults.ts";

/** The screens every dashboard starts with. People can add their own alongside them. */
export const BREAKPOINTS: Screen[] = [
  { key: "sm", label: "Phone", width: 390, height: 760 },
  { key: "md", label: "Tablet", width: 820, height: 1000 },
  { key: "lg", label: "Computer", width: 1440, height: 820 },
];

export const screensOf = (doc: { screens?: Screen[] }): Screen[] =>
  doc.screens?.length ? [...doc.screens].sort((a, b) => a.width - b.width) : BREAKPOINTS;

export const screenByKey = (screens: Screen[], key: BreakpointKey) =>
  screens.find((s) => s.key === key) ?? screens[screens.length - 1] ?? BREAKPOINTS[2];

/** A screen for a window: the largest one that fits, or the smallest if none do. */
export const screenFor = (width: number, screens: Screen[]): BreakpointKey => {
  const sorted = [...screens].sort((a, b) => a.width - b.width);
  const fits = sorted.filter((s) => width >= s.width - 1);
  return (fits[fits.length - 1] ?? sorted[0] ?? BREAKPOINTS[0]).key;
};

/** Copies a widget's layout from the nearest screen, for a screen it hasn't got one for. */
export const nearestLayout = (layouts: Record<string, Rect>, screens: Screen[], key: BreakpointKey): Rect => {
  const target = screenByKey(screens, key);
  const having = screens.filter((s) => layouts[s.key]);
  const closest = having.sort((a, b) => Math.abs(a.width - target.width) - Math.abs(b.width - target.width))[0];
  const base = closest ? layouts[closest.key] : Object.values(layouts)[0];
  if (!base) return { x: 40, y: 40, w: 300, h: 180, hidden: false };
  const from = closest ? screenByKey(screens, closest.key) : target;
  // Bring it into the new screen's width rather than leaving it off the edge.
  const w = Math.min(base.w, target.width - 32);
  const x = Math.max(16, Math.min(base.x, Math.max(16, target.width - w - 16)));
  const y = Math.min(base.y, Math.max(0, target.height - Math.min(base.h, target.height - 32)));
  return { ...base, w, x, y: from.height === target.height ? base.y : y };
};

/**
 * A page is laid out on a fixed stage and then scaled to whatever screen it lands on,
 * by one factor for both directions — so a dashboard fills a phone, a laptop or a
 * television without anything being squashed. Saved positions stay in stage units.
 */
export const designSize = (bp: BreakpointKey, screens: Screen[] = BREAKPOINTS) => {
  const found = screenByKey(screens, bp);
  return { w: found.width, h: found.height };
};

export const stageScale = (bp: BreakpointKey, view: { w: number; h: number }, screens: Screen[] = BREAKPOINTS) => {
  const design = designSize(bp, screens);
  if (!view.w || !view.h) return 1;
  return Math.min(view.w / design.w, view.h / design.h);
};

export const breakpointFor = (width: number, screens: Screen[] = BREAKPOINTS): BreakpointKey =>
  screenFor(width, screens);

export const FONTS = [
  "Space Grotesk",
  "DM Sans",
  "JetBrains Mono",
  "Playfair Display",
  "Bebas Neue",
  "Unbounded",
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

const fitRect = (rect: Rect, screen: Screen): Rect => {
  const w = Math.min(rect.w, screen.width - 32);
  return { ...rect, w, x: Math.max(16, Math.min(rect.x, Math.max(16, screen.width - w - 16))) };
};

export const layoutsFrom = (x: number, y: number, w: number, h: number, screens: Screen[] = BREAKPOINTS) => {
  const widest = screens[screens.length - 1] ?? BREAKPOINTS[2];
  const base: Rect = { x, y, w, h, hidden: false };
  const out: Record<string, Rect> = {};
  for (const screen of screens) out[screen.key] = screen.key === widest.key ? base : fitRect(base, screen);
  return out;
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
  w.layouts?.[bp] ?? w.layouts?.lg ?? Object.values(w.layouts ?? {})[0] ?? { x: 40, y: 40, w: 300, h: 180, hidden: false };

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

const withLayouts = (w: Widget, extra: Record<BreakpointKey, Rect>): Widget => ({
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
  return {
    version: 5,
    mode: "edit",
    panels: [panel],
    activePanelId: panel.id,
    automations: [],
    sources: [],
    library: [],
    screens: BREAKPOINTS.map((s) => ({ ...s })),
  };
};

type Loose = Record<string, any>;

const normalizeWidgets = (widgets: Loose[], screens: Screen[]): Widget[] =>
  widgets.map((w) => {
    const layouts: Record<string, Rect> =
      w.layouts && Object.keys(w.layouts).length
        ? { ...w.layouts }
        : layoutsFrom(w.x ?? 40, w.y ?? 40, w.w ?? 300, w.h ?? 180, screens);
    // A screen added later starts from whichever existing layout is closest in width.
    for (const screen of screens) if (!layouts[screen.key]) layouts[screen.key] = nearestLayout(layouts, screens, screen.key);
    return {
    ...(w as Widget),
    layouts,
    // Saves from before auto-fit existed keep their manual sizing so existing dashboards don't shift.
    style: { ...defaultStyle(), autoFit: false, ...(w.style ?? {}) },
    config: { ...(w.config ?? {}) },
    };
  });

const normalizePanel = (p: Loose, index: number, screens: Screen[] = BREAKPOINTS): Panel => ({
  ...createPanel(`Page ${index + 1}`),
  ...p,
  id: p.id ?? uid(),
  name: p.name ?? `Page ${index + 1}`,
  background: { ...defaultBackground(), ...(p.background ?? {}) },
  widgets: normalizeWidgets(Array.isArray(p.widgets) ? p.widgets : [], screens),
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

const normalizeScreens = (input: unknown): Screen[] => {
  const given = (Array.isArray(input) ? input : [])
    .filter((s: Loose) => s && typeof s.key === "string" && Number(s.width) > 0)
    .map((s: Loose) => ({
      key: s.key,
      label: typeof s.label === "string" ? s.label : s.key,
      width: Math.round(Number(s.width)),
      height: Math.round(Number(s.height) || 800),
      custom: !!s.custom,
    }));
  // The three built-in screens are always present, so old saves keep working.
  const merged = [...BREAKPOINTS.map((b) => given.find((g: Screen) => g.key === b.key) ?? { ...b })];
  for (const screen of given) if (!merged.some((m) => m.key === screen.key)) merged.push(screen);
  return merged.sort((a, b) => a.width - b.width);
};

// Accepts every saved format the app has ever written (flat v1, multi-panel v3, v4).
export function normalizeDoc(input: unknown): BoardDoc {
  const doc = input as Loose;
  if (!doc || typeof doc !== "object") return starterDoc();
  const mode = doc.mode === "display" ? "display" : "edit";
  const screens = normalizeScreens(doc.screens);
  if (Array.isArray(doc.panels) && doc.panels.length > 0) {
    const panels = doc.panels.map((p: Loose, i: number) => normalizePanel(p, i, screens));
    return {
      version: 5,
      mode,
      panels,
      activePanelId: panels.some((p: Panel) => p.id === doc.activePanelId)
        ? doc.activePanelId
        : panels[0].id,
      automations: Array.isArray(doc.automations) ? doc.automations : [],
      sources: normalizeSources(doc.sources),
      library: Array.isArray(doc.library) ? doc.library : [],
      screens,
    };
  }
  if (Array.isArray(doc.widgets)) {
    const panel = normalizePanel(doc, 0, screens);
    return {
      version: 5,
      mode,
      panels: [panel],
      activePanelId: panel.id,
      automations: [],
      sources: normalizeSources(doc.sources),
      library: Array.isArray(doc.library) ? doc.library : [],
      screens,
    };
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
