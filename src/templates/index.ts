import { createPanel, createWidget, uid } from "../lib/board";
import type { BreakpointKey, Panel, WidgetConfig, WidgetStyle, WidgetType } from "../lib/types";
import type { IconName } from "../ui/icons";
import { SPORTS_PANEL, WEATHER_PANEL } from "./panels";

type Box = [x: number, y: number, w: number, h: number];

type Spec = {
  type: WidgetType;
  title: string;
  showTitle?: boolean;
  config?: WidgetConfig;
  style?: Partial<WidgetStyle>;
  computer: Box;
  tablet: Box;
  phone: Box;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  theme: Partial<Panel>;
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

// Panels keep their own text size so lists stay readable; clocks scale with their box.
const panel: Partial<WidgetStyle> = {
  autoFit: false,
  align: "left",
  fontSize: 15,
  padding: 16,
  bg: "#0c1726d9",
  border: "#ffffff1f",
  radius: 16,
  shadow: "soft",
  blur: true,
};
const card: Partial<WidgetStyle> = { bg: "#0c1726d9", border: "#ffffff1f", radius: 16, shadow: "soft", blur: true };

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
    widgets: [
      {
        type: "clock",
        title: "Clock",
        showTitle: false,
        config: { format: "h:mm A", sub: "dddd, DD MMMM", timezone: "" },
        style: card,
        computer: [40, 40, 420, 200],
        tablet: [20, 20, 380, 150],
        phone: [20, 14, 350, 110],
      },
      {
        type: "embed",
        title: "Weather",
        showTitle: true,
        config: { html: WEATHER_PANEL },
        style: panel,
        computer: [480, 40, 460, 200],
        tablet: [420, 20, 380, 150],
        phone: [20, 134, 350, 150],
      },
      {
        type: "embed",
        title: "Live & upcoming",
        showTitle: true,
        config: { html: SPORTS_PANEL },
        style: panel,
        computer: [960, 40, 440, 620],
        tablet: [20, 190, 780, 240],
        phone: [20, 294, 350, 200],
      },
      {
        type: "feed",
        title: "Top stories",
        showTitle: true,
        config: { url: FEEDS.nytTop, count: 9, refresh: 15 },
        style: panel,
        computer: [40, 260, 880, 400],
        tablet: [20, 450, 780, 230],
        phone: [20, 504, 350, 190],
      },
    ],
  },
  {
    id: "morning",
    name: "Morning check-in",
    description: "Big clock, the weather, your plan for the day and the headlines.",
    icon: "clock",
    theme: DUSK,
    popIn: true,
    widgets: [
      {
        type: "clock",
        title: "Clock",
        showTitle: false,
        config: { format: "h:mm", sub: "dddd, DD MMMM", timezone: "" },
        style: card,
        computer: [40, 40, 560, 240],
        tablet: [20, 20, 780, 170],
        phone: [20, 14, 350, 130],
      },
      {
        type: "embed",
        title: "Weather",
        showTitle: true,
        config: { html: WEATHER_PANEL },
        style: { ...panel, bg: "#1a0f18d9" },
        computer: [640, 40, 400, 240],
        tablet: [20, 210, 380, 180],
        phone: [20, 156, 350, 150],
      },
      {
        type: "text",
        title: "Today",
        showTitle: true,
        config: { text: "☕ Coffee\n📞 Stand-up at 9\n🏃 Walk at lunch\n📮 Reply to emails" },
        style: { ...panel, bg: "#1a0f18d9" },
        computer: [1080, 40, 320, 240],
        tablet: [420, 210, 380, 180],
        phone: [20, 316, 350, 150],
      },
      {
        type: "feed",
        title: "Headlines",
        showTitle: true,
        config: { url: FEEDS.bbcTop, count: 8, refresh: 15 },
        style: { ...panel, bg: "#1a0f18d9" },
        computer: [40, 320, 1000, 340],
        tablet: [20, 410, 780, 250],
        phone: [20, 478, 350, 210],
      },
    ],
  },
  {
    id: "scores",
    name: "Sports night",
    description: "Live and upcoming games front and centre, with sports headlines.",
    icon: "activity",
    theme: NIGHT,
    popIn: true,
    widgets: [
      {
        type: "embed",
        title: "Live & upcoming",
        showTitle: true,
        config: { html: SPORTS_PANEL },
        style: panel,
        computer: [40, 40, 700, 620],
        tablet: [20, 20, 780, 360],
        phone: [20, 14, 350, 320],
      },
      {
        type: "clock",
        title: "Clock",
        showTitle: false,
        config: { format: "h:mm A", sub: "dddd, DD MMM", timezone: "" },
        style: card,
        computer: [780, 40, 620, 200],
        tablet: [20, 400, 380, 140],
        phone: [20, 344, 350, 110],
      },
      {
        type: "feed",
        title: "Sports news",
        showTitle: true,
        config: { url: FEEDS.espn, count: 8, refresh: 15 },
        style: panel,
        computer: [780, 260, 620, 400],
        tablet: [420, 400, 380, 140],
        phone: [20, 466, 350, 220],
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
      {
        type: "clock",
        title: "Clock",
        showTitle: false,
        config: { format: "H:mm", sub: "dddd, DD MMMM", timezone: "" },
        style: { ...card, bg: "#12101dcc" },
        computer: [40, 60, 1360, 420],
        tablet: [20, 40, 780, 300],
        phone: [20, 30, 350, 220],
      },
      {
        type: "embed",
        title: "Weather",
        showTitle: false,
        config: { html: WEATHER_PANEL },
        style: { ...panel, bg: "#12101dcc" },
        computer: [40, 500, 660, 180],
        tablet: [20, 360, 780, 150],
        phone: [20, 270, 350, 160],
      },
      {
        type: "feed",
        title: "Headlines",
        showTitle: true,
        config: { url: FEEDS.bbcTop, count: 5, refresh: 15 },
        style: { ...panel, bg: "#12101dcc", fontSize: 17 },
        computer: [720, 500, 680, 180],
        tablet: [20, 530, 780, 150],
        phone: [20, 450, 350, 240],
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
    widgets: [
      {
        type: "clock",
        title: "Clock",
        showTitle: false,
        config: { format: "h:mm A", sub: "dddd, DD MMMM YYYY", timezone: "" },
        style: { ...card, bg: "#12101dcc" },
        computer: [40, 40, 1360, 140],
        tablet: [20, 20, 780, 120],
        phone: [20, 14, 350, 100],
      },
      {
        type: "feed",
        title: "World",
        showTitle: true,
        config: { url: FEEDS.bbcWorld, count: 9, refresh: 15 },
        style: { ...panel, bg: "#12101dcc" },
        computer: [40, 200, 440, 460],
        tablet: [20, 160, 380, 250],
        phone: [20, 128, 350, 190],
      },
      {
        type: "feed",
        title: "Technology",
        showTitle: true,
        config: { url: FEEDS.verge, count: 9, refresh: 15 },
        style: { ...panel, bg: "#12101dcc" },
        computer: [500, 200, 440, 460],
        tablet: [420, 160, 380, 250],
        phone: [20, 330, 350, 190],
      },
      {
        type: "feed",
        title: "Business",
        showTitle: true,
        config: { url: FEEDS.bbcBusiness, count: 9, refresh: 15 },
        style: { ...panel, bg: "#12101dcc" },
        computer: [960, 200, 440, 460],
        tablet: [20, 430, 780, 240],
        phone: [20, 532, 350, 170],
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

export function buildTemplatePanel(template: Template, name?: string): Panel {
  const base = createPanel(name?.trim() || template.name);
  const panelOut: Panel = { ...base, ...template.theme, id: base.id, name: base.name, widgets: [], animations: [] };

  panelOut.widgets = template.widgets.map((spec, i) => {
    const widget = createWidget(spec.type, spec.computer[0], spec.computer[1], i + 1);
    const box = (b: Box) => ({ x: b[0], y: b[1], w: b[2], h: b[3], hidden: false });
    const layouts: Record<BreakpointKey, ReturnType<typeof box>> = {
      lg: box(spec.computer),
      md: box(spec.tablet),
      sm: box(spec.phone),
    };
    return {
      ...widget,
      title: spec.title,
      showTitle: spec.showTitle ?? widget.showTitle,
      layouts,
      config: { ...widget.config, ...(spec.config ?? {}) },
      style: { ...widget.style, ...(spec.style ?? {}) },
    };
  });

  if (template.popIn && panelOut.widgets.length) {
    panelOut.animations = [
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
  return panelOut;
}
