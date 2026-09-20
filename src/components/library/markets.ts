import { bind, col, image, item, param, repeat, row, spacer, text, when } from "../nodes.ts";
import type { CompNode, ComponentDef, Value } from "../types";

const stocks = [{ key: "stocks", kind: "stocks", label: "Stocks & funds" }];
const crypto = [{ key: "crypto", kind: "crypto", label: "Crypto" }];

/** Green when the value is rising, red when it's falling — the same text either way. */
const coloured = (direction: Value, value: Value, size: "sm" | "md" | "lg" | "xl" = "md"): CompNode =>
  when(direction, text(value, { size, weight: 700, color: "positive" }), {
    is: "up",
    else: text(value, { size, weight: 700, color: "negative" }),
  });

const countParam = (label: string, def: number, max = 10) => ({
  key: "count",
  label,
  kind: "number" as const,
  min: 1,
  max,
  default: def,
});

export const MARKET_COMPONENTS: ComponentDef[] = [
  {
    id: "stocks.one",
    name: "Share price",
    description: "One ticker: its price and how much it moved today.",
    icon: "activity",
    category: "Markets",
    size: { w: 300, h: 180 },
    needs: stocks,
    root: col(
      [
        text(bind("stocks", "symbol"), { size: "sm", color: "accent", weight: 700, caps: true }),
        text(bind("stocks", "price"), { size: "2xl", weight: 700 }),
        row(
          [
            coloured(bind("stocks", "direction"), bind("stocks", "change"), "sm"),
            coloured(bind("stocks", "direction"), bind("stocks", "changePct"), "sm"),
          ],
          { gap: 0.4, justify: "center" },
        ),
      ],
      { gap: 0.2, align: "center" },
    ),
  },
  {
    id: "stocks.watchlist",
    name: "Watchlist",
    description: "Every ticker you follow, with today's move.",
    icon: "activity",
    category: "Markets",
    size: { w: 380, h: 260 },
    needs: stocks,
    params: [countParam("How many tickers", 5)],
    root: col(
      [
        row([text("Watchlist", { size: "xs", color: "muted", caps: true, weight: 600 }), spacer, text(bind("stocks", "marketState"), { size: "xs", color: "muted" })]),
        repeat(
          "stocks",
          "tickers",
          row([
            text(item("symbol"), { size: "sm", weight: 700, grow: true }),
            text(item("price"), { size: "sm" }),
            spacer,
            coloured(item("direction"), item("changePct"), "sm"),
          ], { gap: 0.5 }),
          { gap: 0.55, limit: param("count"), empty: "No tickers set." },
        ),
      ],
      { gap: 0.5 },
    ),
  },
  {
    id: "stocks.timeframes",
    name: "One ticker, every timeframe",
    description: "Day, week, month and year moves for your first ticker.",
    icon: "activity",
    category: "Markets",
    size: { w: 340, h: 240 },
    needs: stocks,
    root: col(
      [
        row([text(bind("stocks", "symbol"), { size: "lg", weight: 700 }), spacer, text(bind("stocks", "price"), { size: "lg", weight: 700 })]),
        row([text("Today", { size: "sm", color: "muted" }), spacer, coloured(bind("stocks", "direction"), bind("stocks", "changePct"), "sm")]),
        row([text("This week", { size: "sm", color: "muted" }), spacer, text(bind("stocks", "tickers.0.weekPct"), { size: "sm", weight: 600 })]),
        row([text("This month", { size: "sm", color: "muted" }), spacer, text(bind("stocks", "tickers.0.monthPct"), { size: "sm", weight: 600 })]),
        row([text("This year", { size: "sm", color: "muted" }), spacer, text(bind("stocks", "tickers.0.yearPct"), { size: "sm", weight: 600 })]),
      ],
      { gap: 0.45, justify: "center" },
    ),
  },
  {
    id: "stocks.movers",
    name: "Big movers today",
    description: "The market's biggest gainers, with how far they jumped.",
    icon: "activity",
    category: "Markets",
    size: { w: 340, h: 260 },
    needs: stocks,
    params: [countParam("How many", 5, 8)],
    root: col(
      [
        text("Biggest gainers", { size: "xs", color: "accent", caps: true, weight: 600 }),
        repeat(
          "stocks",
          "gainers",
          row([
            text(item("symbol"), { size: "sm", weight: 700, grow: true }),
            text(item("price"), { size: "sm", color: "muted" }),
            spacer,
            text(item("changePct"), { size: "sm", weight: 700, color: "positive" }),
          ], { gap: 0.4 }),
          { gap: 0.5, limit: param("count"), empty: "Movers not available right now." },
        ),
      ],
      { gap: 0.5 },
    ),
  },
  {
    id: "stocks.news",
    name: "Ticker headlines",
    description: "Recent news about the first ticker on your list.",
    icon: "news",
    category: "Markets",
    size: { w: 400, h: 260 },
    needs: stocks,
    params: [countParam("How many headlines", 5)],
    root: col(
      [
        row([text(bind("stocks", "symbol"), { size: "xs", color: "accent", caps: true, weight: 700 }), text("in the news", { size: "xs", color: "muted", caps: true })], { gap: 0.3 }),
        repeat("stocks", "headlines", text(item("title"), { size: "sm", lines: 2 }), {
          gap: 0.55,
          limit: param("count"),
          empty: "No headlines right now.",
        }),
      ],
      { gap: 0.5 },
    ),
  },
  {
    id: "crypto.one",
    name: "Coin price",
    description: "One coin with its logo and 24-hour move.",
    icon: "gauge",
    category: "Markets",
    size: { w: 300, h: 180 },
    needs: crypto,
    root: col(
      [
        row([image(bind("crypto", "image"), { size: 1.4, radius: 1 }), text(bind("crypto", "name"), { size: "sm", color: "muted" })], { gap: 0.4, justify: "center" }),
        text(bind("crypto", "price"), { size: "2xl", weight: 700 }),
        coloured(bind("crypto", "direction"), bind("crypto", "change24h"), "sm"),
      ],
      { gap: 0.25, align: "center" },
    ),
  },
  {
    id: "crypto.list",
    name: "Coin watchlist",
    description: "Your coins with price and 24-hour move.",
    icon: "gauge",
    category: "Markets",
    size: { w: 380, h: 240 },
    needs: crypto,
    params: [countParam("How many coins", 4, 8)],
    root: repeat(
      "crypto",
      "coins",
      row([
        image(item("image"), { size: 1.2, radius: 1 }),
        text(item("symbol"), { size: "sm", weight: 700 }),
        spacer,
        text(item("price"), { size: "sm" }),
        coloured(item("direction"), item("change24h"), "sm"),
      ], { gap: 0.45 }),
      { gap: 0.6, limit: param("count"), empty: "No coins set." },
    ),
  },
  {
    id: "crypto.mood",
    name: "Fear & greed",
    description: "The crypto market's mood as a score out of 100.",
    icon: "gauge",
    category: "Markets",
    size: { w: 300, h: 170 },
    needs: crypto,
    root: col(
      [
        text(bind("crypto", "fearGreed"), { size: "3xl", weight: 700 }),
        text(bind("crypto", "fearGreedLabel"), { size: "sm", color: "accent", caps: true, weight: 600 }),
        { kind: "bar", value: bind("crypto", "fearGreed"), max: "100", color: "accent" },
      ],
      { gap: 0.35, align: "center", justify: "center" },
    ),
  },
  {
    id: "currency.rate",
    name: "Exchange rate",
    description: "What one currency is worth in another.",
    icon: "refresh",
    category: "Markets",
    size: { w: 320, h: 170 },
    needs: [{ key: "currency", kind: "currency", label: "Exchange rates" }],
    root: col(
      [
        row([text("1", { size: "lg", weight: 700 }), text(bind("currency", "base"), { size: "lg", color: "muted" })], { gap: 0.25, justify: "center" }),
        row([text(bind("currency", "rate"), { size: "2xl", weight: 700 }), text(bind("currency", "code"), { size: "md", color: "accent", weight: 600 })], { gap: 0.3, justify: "center" }),
      ],
      { gap: 0.2, align: "center", justify: "center" },
    ),
  },
  {
    id: "currency.table",
    name: "Rate table",
    description: "Several currencies at once, against your base.",
    icon: "refresh",
    category: "Markets",
    size: { w: 320, h: 220 },
    needs: [{ key: "currency", kind: "currency", label: "Exchange rates" }],
    root: col(
      [
        row([text("1", { size: "xs", color: "muted" }), text(bind("currency", "base"), { size: "xs", color: "muted", weight: 700 }), text("buys", { size: "xs", color: "muted" })], { gap: 0.25 }),
        repeat(
          "currency",
          "rates",
          row([text(item("code"), { size: "sm", weight: 600, grow: true }), spacer, text(item("rate"), { size: "sm" })], { gap: 0.4 }),
          { gap: 0.5, limit: "6", empty: "No rates yet." },
        ),
      ],
      { gap: 0.4 },
    ),
  },
];
