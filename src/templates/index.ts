import { definitionFor } from "../components/library";
import { createComponentWidget, createPanel, createWidget, uid } from "../lib/board";
import { createSource } from "../data/registry";
import type { DataSource } from "../data/types";
import type { BreakpointKey, Panel, Rect, Widget, WidgetConfig, WidgetStyle, WidgetType } from "../lib/types";
import type { IconName } from "../ui/icons";

type Box = [x: number, y: number, w: number, h: number];
/** "hidden" leaves a component off that screen entirely — phones can't fit everything. */
type Slot = Box | "hidden";

/** A template's own data sources, so "Sports night" can use a sports feed for its headlines. */
type SourceSpec = { key: string; kind: string; name?: string; params?: Record<string, string> };

type Spec = {
  title: string;
  showTitle?: boolean;
  style?: Partial<WidgetStyle>;
  computer: Box;
  tablet: Slot;
  phone: Slot;
} & (
  | { component: string; settings?: Record<string, string | number>; use?: Record<string, string>; type?: never; config?: never }
  | { type: WidgetType; config?: WidgetConfig; component?: never }
);

export type Template = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  theme: Partial<Panel>;
  sources?: SourceSpec[];
  widgets: Spec[];
  popIn?: boolean;
};

const NIGHT = {
  accent: "#6ec3ff",
  fontFamily: "Space Grotesk",
  background: { kind: "gradient", color: "#060b14", color2: "#143050", angle: 160, imageUrl: "", imageFit: "cover", dim: 0 },
} as const;

const DUSK = {
  accent: "#ffb457",
  fontFamily: "Space Grotesk",
  background: { kind: "gradient", color: "#140b12", color2: "#48243a", angle: 150, imageUrl: "", imageFit: "cover", dim: 0 },
} as const;

const INK = {
  accent: "#c7b8ff",
  fontFamily: "DM Sans",
  background: { kind: "gradient", color: "#0b0a12", color2: "#221a3a", angle: 145, imageUrl: "", imageFit: "cover", dim: 0 },
} as const;

const card: Partial<WidgetStyle> = { bg: "#0c1726d9", border: "#ffffff1f", radius: 16, shadow: "soft", blur: true };
const plum: Partial<WidgetStyle> = { ...card, bg: "#1a0f18d9" };
const violet: Partial<WidgetStyle> = { ...card, bg: "#12101dcc" };

const FEEDS = {
  nytTop: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  bbcTop: "https://feeds.bbci.co.uk/news/rss.xml",
  bbcWorld: "https://feeds.bbci.co.uk/news/world/rss.xml",
  bbcBusiness: "https://feeds.bbci.co.uk/news/business/rss.xml",
  verge: "https://www.theverge.com/rss/index.xml",
  espn: "https://www.espn.com/espn/rss/news",
};

export const TEMPLATES: Template[] = [
  {
    id: "home",
    name: "Home base",
    description: "Clock, weather, headlines and live scores — an at-a-glance start page.",
    icon: "pages",
    theme: NIGHT,
    popIn: true,
    sources: [{ key: "top", kind: "news", name: "Top stories", params: { url: FEEDS.nytTop } }],
    widgets: [
      { component: "time.big", title: "Clock", style: card, computer: [40, 40, 420, 200], tablet: [20, 20, 380, 150], phone: [20, 14, 350, 120] },
      { component: "weather.now", title: "Weather", style: card, computer: [480, 40, 440, 200], tablet: [420, 20, 380, 150], phone: [20, 146, 350, 160] },
      {
        component: "sports.live",
        title: "Live & upcoming",
        showTitle: true,
        settings: { count: 4 },
        style: card,
        computer: [960, 40, 440, 620],
        tablet: [20, 190, 780, 230],
        phone: [20, 318, 350, 190],
      },
      {
        component: "news.list",
        title: "Top stories",
        showTitle: true,
        use: { news: "top" },
        settings: { count: 8 },
        style: card,
        computer: [40, 260, 880, 400],
        tablet: [20, 440, 780, 240],
        phone: [20, 520, 350, 190],
      },
    ],
  },
  {
    id: "morning",
    name: "Morning check-in",
    description: "A greeting, the weather in detail, your plan for the day and the headlines.",
    icon: "clock",
    theme: DUSK,
    popIn: true,
    widgets: [
      { component: "time.greeting", title: "Good morning", style: plum, computer: [40, 40, 560, 220], tablet: [20, 20, 780, 160], phone: [20, 14, 350, 106] },
      { component: "weather.now", title: "Weather", style: plum, computer: [640, 40, 380, 220], tablet: [20, 200, 380, 190], phone: [20, 132, 350, 148] },
      { component: "weather.details", title: "Details", style: plum, computer: [1060, 40, 340, 220], tablet: [420, 200, 380, 190], phone: "hidden" },
      {
        type: "text",
        title: "Today",
        showTitle: true,
        config: { text: "☕ Coffee\n📞 Stand-up at 9\n🏃 Walk at lunch\n📮 Reply to emails" },
        style: { ...plum, autoFit: false, align: "left", fontSize: 15, padding: 16 },
        computer: [40, 300, 420, 360],
        tablet: [20, 410, 380, 250],
        phone: [20, 292, 350, 150],
      },
      {
        component: "news.times",
        title: "Headlines",
        showTitle: true,
        settings: { count: 6 },
        style: plum,
        computer: [500, 300, 900, 360],
        tablet: [420, 410, 380, 250],
        phone: [20, 454, 350, 252],
      },
    ],
  },
  {
    id: "scores",
    name: "Sports night",
    description: "Live scores front and centre, the next game, and sports headlines.",
    icon: "trophy",
    theme: NIGHT,
    popIn: true,
    sources: [{ key: "sportsNews", kind: "news", name: "Sports news", params: { url: FEEDS.espn } }],
    widgets: [
      {
        component: "sports.live",
        title: "Live now",
        showTitle: true,
        settings: { count: 6 },
        style: card,
        computer: [40, 40, 700, 400],
        tablet: [20, 20, 780, 280],
        phone: [20, 14, 350, 240],
      },
      { component: "sports.next", title: "Next game", style: card, computer: [40, 460, 700, 200], tablet: [20, 320, 380, 170], phone: [20, 266, 350, 140] },
      { component: "time.simple", title: "Clock", style: card, computer: [780, 40, 620, 180], tablet: [420, 320, 380, 170], phone: [20, 418, 350, 100] },
      {
        component: "news.list",
        title: "Sports news",
        showTitle: true,
        use: { news: "sportsNews" },
        settings: { count: 7 },
        style: card,
        computer: [780, 240, 620, 420],
        tablet: [20, 510, 780, 300],
        phone: [20, 530, 350, 176],
      },
    ],
  },
  {
    id: "wall",
    name: "Wall display",
    description: "Made to be looked at from across the room: huge clock, weather and news.",
    icon: "computer",
    theme: INK,
    widgets: [
      { component: "time.big", title: "Clock", style: violet, computer: [40, 60, 1360, 400], tablet: [20, 40, 780, 300], phone: [20, 30, 350, 200] },
      { component: "weather.compact", title: "Weather", style: violet, computer: [40, 490, 660, 190], tablet: [20, 360, 780, 150], phone: [20, 250, 350, 140] },
      {
        component: "news.top",
        title: "Top story",
        style: violet,
        computer: [720, 490, 680, 190],
        tablet: [20, 530, 780, 150],
        phone: [20, 410, 350, 180],
      },
    ],
  },
  {
    id: "reader",
    name: "News wall",
    description: "Three feeds side by side — world, technology and business.",
    icon: "news",
    theme: INK,
    popIn: true,
    sources: [
      { key: "world", kind: "news", name: "World", params: { url: FEEDS.bbcWorld } },
      { key: "tech", kind: "news", name: "Technology", params: { url: FEEDS.verge } },
      { key: "business", kind: "news", name: "Business", params: { url: FEEDS.bbcBusiness } },
    ],
    widgets: [
      { component: "time.big", title: "Clock", style: violet, computer: [40, 40, 1360, 140], tablet: [20, 20, 780, 120], phone: [20, 14, 350, 100] },
      {
        component: "news.list",
        title: "World",
        showTitle: true,
        use: { news: "world" },
        settings: { count: 8 },
        style: violet,
        computer: [40, 200, 440, 460],
        tablet: [20, 160, 380, 250],
        phone: [20, 128, 350, 190],
      },
      {
        component: "news.list",
        title: "Technology",
        showTitle: true,
        use: { news: "tech" },
        settings: { count: 8 },
        style: violet,
        computer: [500, 200, 440, 460],
        tablet: [420, 160, 380, 250],
        phone: [20, 330, 350, 190],
      },
      {
        component: "news.list",
        title: "Business",
        showTitle: true,
        use: { news: "business" },
        settings: { count: 8 },
        style: violet,
        computer: [960, 200, 440, 460],
        tablet: [20, 430, 780, 240],
        phone: [20, 532, 350, 168],
      },
    ],
  },
  {
    id: "blank",
    name: "Empty page",
    description: "A clean page with nothing on it.",
    icon: "plus",
    theme: INK,
    widgets: [],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** What a template will put on the page, for menus and the bridge's list_templates. */
export const templateContents = (t: Template) =>
  t.widgets.map((spec) => (spec.component ? definitionFor(spec.component)?.name ?? spec.title : spec.title));

const box = (slot: Slot, fallback: Box): Rect => {
  const b = slot === "hidden" ? fallback : slot;
  return { x: b[0], y: b[1], w: b[2], h: b[3], hidden: slot === "hidden" };
};

/**
 * Builds the page and whatever data sources it needs. Sources the dashboard already
 * has are reused when their settings match, so applying two templates doesn't fetch twice.
 */
export function buildTemplate(
  template: Template,
  existing: DataSource[],
  name?: string,
): { panel: Panel; sources: DataSource[] } {
  const base = createPanel(name?.trim() || template.name);
  const panel: Panel = { ...base, ...template.theme, id: base.id, name: base.name, widgets: [], animations: [] };
  const sources = [...existing];
  const byKey: Record<string, string> = {};

  const reuseOrCreate = (kind: string, params?: Record<string, string>, name?: string) => {
    const match = sources.find(
      (s) => s.kind === kind && Object.entries(params ?? {}).every(([k, v]) => s.params[k] === v),
    );
    if (match) return match;
    const created = createSource(kind, params);
    if (created) sources.push(name ? { ...created, name } : created);
    return created && name ? { ...created, name } : created;
  };

  for (const spec of template.sources ?? []) {
    const source = reuseOrCreate(spec.kind, spec.params, spec.name);
    if (source) byKey[spec.key] = source.id;
  }

  panel.widgets = template.widgets.map((spec, i) => {
    const layouts: Record<BreakpointKey, Rect> = {
      lg: box(spec.computer, spec.computer),
      md: box(spec.tablet, spec.computer),
      sm: box(spec.phone, spec.computer),
    };

    if (spec.component) {
      const def = definitionFor(spec.component);
      const slots: Record<string, string> = {};
      for (const need of def?.needs ?? []) {
        const fromTemplate = spec.use?.[need.key] ? byKey[spec.use[need.key]] : null;
        const source = fromTemplate
          ? sources.find((s) => s.id === fromTemplate)
          : need.optional
            ? sources.find((s) => s.kind === need.kind)
            : reuseOrCreate(need.kind);
        if (source) slots[need.key] = source.id;
      }
      const widget = createComponentWidget(
        { defId: spec.component, sources: slots, params: { ...(spec.settings ?? {}) } },
        { name: spec.title, w: spec.computer[2], h: spec.computer[3] },
        spec.computer[0],
        spec.computer[1],
        i + 1,
      );
      return {
        ...widget,
        showTitle: spec.showTitle ?? false,
        layouts,
        style: { ...widget.style, ...(spec.style ?? {}) },
      } satisfies Widget;
    }

    const widget = createWidget(spec.type ?? "text", spec.computer[0], spec.computer[1], i + 1);
    return {
      ...widget,
      title: spec.title,
      showTitle: spec.showTitle ?? widget.showTitle,
      layouts,
      config: { ...widget.config, ...(spec.config ?? {}) },
      style: { ...widget.style, ...(spec.style ?? {}) },
    };
  });

  if (template.popIn && panel.widgets.length) {
    panel.animations = [
      {
        id: uid(),
        name: "Everything pops in",
        enabled: true,
        trigger: { kind: "pageShown" },
        target: { widgetId: "@all", part: "whole" },
        effect: { kind: "preset", preset: "popIn" },
        timing: { duration: 650, delay: 0, easing: "cubic-bezier(.34,1.56,.64,1)", repeat: 1, alternate: false, keepEnd: false },
      },
    ];
  }

  return { panel, sources };
}
