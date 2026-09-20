import { bind, col, item, param, repeat, row, spacer, text } from "../nodes";
import type { ComponentDef } from "../types";

const needs = [{ key: "news", kind: "news", label: "News headlines" }];

const countParam = { key: "count", label: "How many headlines", kind: "number" as const, min: 1, max: 12, default: 5 };

export const NEWS_COMPONENTS: ComponentDef[] = [
  {
    id: "news.list",
    name: "Headlines",
    description: "A simple list of the latest headlines.",
    icon: "news",
    category: "News",
    size: { w: 400, h: 300 },
    needs,
    params: [countParam],
    root: col(
      [
        text(bind("news", "source"), { size: "xs", color: "accent", caps: true, weight: 600 }),
        repeat("news", "items", text(item("title"), { size: "sm", lines: 2 }), {
          gap: 0.6,
          limit: param("count"),
          empty: "No headlines right now.",
        }),
      ],
      { gap: 0.5 },
    ),
  },
  {
    id: "news.top",
    name: "Top story",
    description: "The latest headline on its own, nice and big.",
    icon: "news",
    category: "News",
    size: { w: 420, h: 200 },
    needs,
    root: col(
      [
        text("Top story", { size: "xs", color: "accent", caps: true, weight: 600 }),
        text(bind("news", "top"), { size: "lg", weight: 600, lines: 3 }),
        text(bind("news", "source"), { size: "xs", color: "muted" }),
      ],
      { gap: 0.35, justify: "center" },
    ),
  },
  {
    id: "news.times",
    name: "Headlines with times",
    description: "Each headline with how long ago it was published.",
    icon: "news",
    category: "News",
    size: { w: 440, h: 300 },
    needs,
    params: [countParam],
    root: repeat(
      "news",
      "items",
      row([text(item("title"), { size: "sm", lines: 2, grow: true }), spacer, text(item("time"), { size: "xs", color: "muted" })], {
        gap: 0.6,
        align: "start",
      }),
      { gap: 0.65, limit: param("count"), empty: "No headlines right now." },
    ),
  },
  {
    id: "news.cards",
    name: "Headlines with pictures",
    description: "Headlines alongside the pictures from the feed.",
    icon: "image",
    category: "News",
    size: { w: 460, h: 320 },
    needs,
    params: [{ ...countParam, default: 4 }],
    root: repeat(
      "news",
      "items",
      row([{ kind: "image", value: item("image"), size: 2.6, radius: 0.35 }, text(item("title"), { size: "sm", lines: 3, grow: true })], {
        gap: 0.6,
        align: "center",
      }),
      { gap: 0.7, limit: param("count"), empty: "No headlines right now." },
    ),
  },
];
