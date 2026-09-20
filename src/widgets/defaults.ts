import type { WidgetConfig, WidgetType } from "../lib/types";

export const WIDGET_DEFAULTS: Record<WidgetType, { title: string; w: number; h: number; config: WidgetConfig }> = {
  clock: {
    title: "Clock",
    w: 320,
    h: 160,
    config: { format: "HH:mm:ss", sub: "dddd, DD MMM YYYY", timezone: "" },
  },
  text: {
    title: "Note",
    w: 300,
    h: 180,
    config: { text: "Double-click me (or tap the pencil) to write something here." },
  },
  image: {
    title: "Image",
    w: 320,
    h: 220,
    config: { url: "https://picsum.photos/600/400", fit: "cover" },
  },
  iframe: {
    title: "Web page",
    w: 420,
    h: 300,
    config: { url: "https://example.com" },
  },
  feed: {
    title: "News feed",
    w: 380,
    h: 320,
    config: { url: "https://feeds.bbci.co.uk/news/rss.xml", count: 6, refresh: 15 },
  },
  api: {
    title: "Live value",
    w: 320,
    h: 180,
    config: {
      url: "https://api.coindesk.com/v1/bpi/currentprice.json",
      path: "bpi.USD.rate",
      prefix: "$",
      suffix: "",
      refresh: 5,
    },
  },
  component: {
    title: "Component",
    w: 320,
    h: 180,
    config: {},
  },
  embed: {
    title: "Custom code",
    w: 360,
    h: 240,
    config: {
      html: `<div style="font:600 20px system-ui;color:#fff">Hello 👋</div>\n<script>document.body.style.background='transparent'</script>`,
    },
  },
};
