import type { FieldDef, SourceKind } from "../types";
import { fetchJson, num } from "./shared.ts";

const money = { decimals: 2, prefix: "$" };
const percent = { decimals: 2, unit: "%" };

const tickerFields: FieldDef[] = [
  { key: "symbol", label: "Ticker", type: "text", example: "AAPL" },
  { key: "price", label: "Price", type: "number", format: money, example: 336.13 },
  { key: "change", label: "Change today", type: "number", format: { decimals: 2 }, example: -1.4 },
  { key: "changePct", label: "Change today %", type: "number", format: percent, example: -0.42 },
  { key: "direction", label: "Up or down", type: "text", hint: 'Reads "up" or "down" — handy for a condition.', example: "down" },
  { key: "arrow", label: "Arrow", type: "text", example: "▼" },
  { key: "weekPct", label: "Change this week %", type: "number", format: percent, example: 1.8 },
  { key: "monthPct", label: "Change this month %", type: "number", format: percent, example: 4.2 },
  { key: "yearPct", label: "Change this year %", type: "number", format: percent, example: 31.5 },
  { key: "high52", label: "52-week high", type: "number", format: money, example: 352.1 },
  { key: "low52", label: "52-week low", type: "number", format: money, example: 208.4 },
  { key: "open", label: "Open", type: "number", format: money, example: 334.2 },
  { key: "dayHigh", label: "Day high", type: "number", format: money, example: 338.9 },
  { key: "dayLow", label: "Day low", type: "number", format: money, example: 332.5 },
  { key: "volume", label: "Volume", type: "number", format: { decimals: 0 }, example: 86588219 },
  { key: "bid", label: "Bid", type: "number", format: money, example: 335.47 },
  { key: "ask", label: "Ask", type: "number", format: money, example: 335.7 },
];

const moverFields: FieldDef[] = [
  { key: "symbol", label: "Ticker", type: "text", example: "NVDA" },
  { key: "price", label: "Price", type: "number", format: money, example: 122.4 },
  { key: "change", label: "Change", type: "number", format: { decimals: 2 }, example: 9.1 },
  { key: "changePct", label: "Change %", type: "number", format: percent, example: 8.03 },
  { key: "volume", label: "Volume", type: "number", format: { decimals: 0 }, example: 512_000_000 },
];

const headlineFields: FieldDef[] = [
  { key: "title", label: "Headline", type: "text", example: "Apple unveils something" },
  { key: "time", label: "Published", type: "time", format: { relative: true }, example: "2026-09-19T14:00:00Z" },
  { key: "link", label: "Link", type: "text", example: "" },
];

const exampleTickers = [
  { symbol: "AAPL", price: 336.13, change: -1.4, changePct: -0.42, direction: "down", arrow: "▼", weekPct: 1.8, monthPct: 4.2, yearPct: 31.5, high52: 352.1, low52: 208.4, open: 334.2, dayHigh: 338.9, dayLow: 332.5, volume: 86588219, bid: 335.47, ask: 335.7 },
  { symbol: "MSFT", price: 512.6, change: 4.2, changePct: 0.83, direction: "up", arrow: "▲", weekPct: 2.4, monthPct: 6.1, yearPct: 22.8, high52: 530.2, low52: 388.1, open: 509.4, dayHigh: 514.9, dayLow: 507.2, volume: 21400000, bid: 512.4, ask: 512.8 },
  { symbol: "NVDA", price: 188.2, change: -2.6, changePct: -1.36, direction: "down", arrow: "▼", weekPct: -3.1, monthPct: 8.8, yearPct: 64.2, high52: 212.9, low52: 86.6, open: 190.1, dayHigh: 191.4, dayLow: 186.9, volume: 312000000, bid: 188.1, ask: 188.3 },
];

/** Market hours are New York's, so the label is worked out in that time zone. */
const marketState = () => {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const minutes = ny.getHours() * 60 + ny.getMinutes();
  const weekend = ny.getDay() === 0 || ny.getDay() === 6;
  if (weekend) return { open: "no", label: "Closed for the weekend" };
  if (minutes < 4 * 60) return { open: "no", label: "Closed" };
  if (minutes < 9 * 60 + 30) return { open: "no", label: "Pre-market" };
  if (minutes < 16 * 60) return { open: "yes", label: "Open" };
  if (minutes < 20 * 60) return { open: "no", label: "After hours" };
  return { open: "no", label: "Closed" };
};

const pctFrom = (now: number, then: number) => (then ? ((now - then) / then) * 100 : 0);

const TWELVE = "https://api.twelvedata.com";

/** Older closes, used for the week / month / year moves. Missing history just reads zero. */
async function closesFor(symbol: string, key: string) {
  try {
    const data = await fetchJson(`${TWELVE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=260&apikey=${key}`);
    // Twelve Data returns newest first.
    return (data.values ?? []).map((v: any) => num(v.close)).reverse();
  } catch {
    return [];
  }
}

const readQuote = (q: any, closes: number[]) => {
  const price = num(q.close);
  const changePct = num(q.percent_change);
  const back = (days: number) => closes[Math.max(0, closes.length - 1 - days)] ?? closes[0] ?? price;
  const up = changePct >= 0;
  return {
    symbol: String(q.symbol ?? "").toUpperCase(),
    price,
    change: num(q.change),
    changePct,
    direction: up ? "up" : "down",
    arrow: up ? "▲" : "▼",
    weekPct: closes.length ? pctFrom(price, back(5)) : 0,
    monthPct: closes.length ? pctFrom(price, back(21)) : 0,
    yearPct: closes.length ? pctFrom(price, closes[0]) : 0,
    high52: num(q.fifty_two_week?.high),
    low52: num(q.fifty_two_week?.low),
    open: num(q.open),
    dayHigh: num(q.high),
    dayLow: num(q.low),
    volume: num(q.volume),
    bid: 0,
    ask: 0,
  };
};

export const stocksSource: SourceKind = {
  kind: "stocks",
  label: "Stocks & funds",
  description: "Prices and changes for the tickers you follow, the day's big movers, and their headlines.",
  icon: "activity",
  group: "Markets",
  refreshSec: 600,
  params: [
    {
      key: "tickers",
      label: "Tickers",
      kind: "text",
      hint: "Up to five, separated by commas. Shares and funds both work — AAPL, VTI, SPY.",
      placeholder: "AAPL, MSFT, NVDA",
      default: "AAPL",
    },
    {
      key: "key",
      label: "Twelve Data key",
      kind: "text",
      hint: "Free and instant from twelvedata.com. Without one only AAPL works — every other ticker needs a key. It is stored in this browser only.",
      placeholder: "Leave empty to try AAPL",
      default: "",
    },
  ],
  fields: [
    { key: "tickers", label: "Your tickers", type: "list", of: tickerFields, example: exampleTickers },
    { key: "symbol", label: "First ticker", type: "text", example: "AAPL" },
    { key: "price", label: "First ticker price", type: "number", format: money, example: 336.13 },
    { key: "change", label: "First ticker change", type: "number", format: { decimals: 2 }, example: -1.4 },
    { key: "changePct", label: "First ticker change %", type: "number", format: percent, example: -0.42 },
    { key: "direction", label: "First ticker up or down", type: "text", example: "down" },
    { key: "gainers", label: "Biggest gainers today", type: "list", of: moverFields, example: exampleTickers.slice(0, 2) },
    { key: "losers", label: "Biggest losers today", type: "list", of: moverFields, example: exampleTickers.slice(0, 2) },
    { key: "mostActive", label: "Most traded today", type: "list", of: moverFields, example: exampleTickers },
    { key: "headlines", label: "Headlines about your first ticker", type: "list", of: headlineFields, example: [] },
    { key: "marketOpen", label: "Market open", type: "text", hint: '"yes" or "no".', example: "yes" },
    { key: "marketState", label: "Market state", type: "text", example: "Open" },
    { key: "updated", label: "Last updated", type: "time", format: { relative: true }, example: "2026-09-19T20:00:00Z" },
  ],
  async load(params) {
    const symbols = (params.tickers || "AAPL")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 5);
    const key = (params.key || "").trim() || "demo";

    const quotes = await fetchJson(`${TWELVE}/quote?symbol=${symbols.map(encodeURIComponent).join(",")}&apikey=${key}`);
    if (quotes.status === "error" || quotes.code === 401) {
      throw new Error(
        key === "demo"
          ? "Without a key only AAPL works. Get a free Twelve Data key (it takes seconds) and paste it into this source's settings."
          : `The market data service said: ${quotes.message ?? "that key was refused"}`,
      );
    }
    // One symbol comes back on its own; several come back keyed by ticker.
    const raw = symbols.length === 1 ? [quotes] : symbols.map((s) => quotes[s]).filter(Boolean);
    const histories = await Promise.all(raw.slice(0, 3).map((q: any) => closesFor(q.symbol, key)));
    const tickers = raw.map((q: any, i: number) => readQuote(q, histories[i] ?? []));
    if (!tickers.length) throw new Error("Couldn't read any of those tickers. Check the symbols.");

    // Market-wide movers and the ticker's headlines are extras: never fail the whole source over them.
    const [moversResult, newsResult] = await Promise.allSettled([
      fetchJson("https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=demo"),
      fetchJson(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
          `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbols[0]}&region=US&lang=en-US`,
        )}`,
      ),
    ]);

    const movers = moversResult.status === "fulfilled" ? moversResult.value : {};
    const readMovers = (list: any[]) =>
      (list ?? []).slice(0, 8).map((m: any) => ({
        symbol: m.ticker ?? "",
        price: num(m.price),
        change: num(m.change_amount),
        changePct: num(String(m.change_percentage ?? "").replace("%", "")),
        volume: num(m.volume),
      }));

    const news = newsResult.status === "fulfilled" ? newsResult.value : {};
    const state = marketState();
    const openNow = raw[0]?.is_market_open;

    return {
      tickers,
      symbol: tickers[0].symbol,
      price: tickers[0].price,
      change: tickers[0].change,
      changePct: tickers[0].changePct,
      direction: tickers[0].direction,
      gainers: readMovers(movers.top_gainers),
      losers: readMovers(movers.top_losers),
      mostActive: readMovers(movers.most_actively_traded),
      headlines: (news.items ?? []).slice(0, 8).map((item: any) => ({
        title: item.title ?? "",
        time: item.pubDate ? String(item.pubDate).replace(" ", "T") : "",
        link: item.link ?? "",
      })),
      marketOpen: openNow === undefined ? state.open : openNow ? "yes" : "no",
      marketState: state.label,
      updated: new Date().toISOString(),
    };
  },
};

const coinFields: FieldDef[] = [
  { key: "name", label: "Name", type: "text", example: "Bitcoin" },
  { key: "symbol", label: "Symbol", type: "text", example: "BTC" },
  { key: "price", label: "Price", type: "number", format: { decimals: 2 }, example: 94120 },
  { key: "change1h", label: "Change 1 hour %", type: "number", format: percent, example: 0.4 },
  { key: "change24h", label: "Change 24 hours %", type: "number", format: percent, example: -2.1 },
  { key: "change7d", label: "Change 7 days %", type: "number", format: percent, example: 6.4 },
  { key: "change30d", label: "Change 30 days %", type: "number", format: percent, example: 12.9 },
  { key: "change1y", label: "Change 1 year %", type: "number", format: percent, example: 48.2 },
  { key: "direction", label: "Up or down today", type: "text", example: "down" },
  { key: "arrow", label: "Arrow", type: "text", example: "▼" },
  { key: "marketCap", label: "Market value", type: "number", format: { decimals: 0 }, example: 1860000000000 },
  { key: "rank", label: "Rank", type: "number", format: { decimals: 0 }, example: 1 },
  { key: "volume", label: "Traded in 24 hours", type: "number", format: { decimals: 0 }, example: 42000000000 },
  { key: "high24h", label: "24-hour high", type: "number", format: { decimals: 2 }, example: 96100 },
  { key: "low24h", label: "24-hour low", type: "number", format: { decimals: 2 }, example: 92800 },
  { key: "ath", label: "All-time high", type: "number", format: { decimals: 2 }, example: 108000 },
  { key: "athPct", label: "Below all-time high %", type: "number", format: percent, example: -12.8 },
  { key: "image", label: "Logo", type: "image", example: "" },
];

export const cryptoSource: SourceKind = {
  kind: "crypto",
  label: "Crypto",
  description: "Coin prices over every timeframe, the day's movers, and the fear & greed mood.",
  icon: "gauge",
  group: "Markets",
  refreshSec: 300,
  params: [
    {
      key: "coins",
      label: "Coins",
      kind: "text",
      hint: "CoinGecko names, comma separated — bitcoin, ethereum, solana, dogecoin.",
      placeholder: "bitcoin, ethereum",
      default: "bitcoin, ethereum, solana",
    },
    {
      key: "currency",
      label: "Shown in",
      kind: "select",
      default: "usd",
      options: [
        { value: "usd", label: "US dollars" },
        { value: "eur", label: "Euros" },
        { value: "gbp", label: "Pounds" },
      ],
    },
  ],
  fields: [
    { key: "coins", label: "Your coins", type: "list", of: coinFields, example: [] },
    { key: "name", label: "First coin name", type: "text", example: "Bitcoin" },
    { key: "price", label: "First coin price", type: "number", format: { decimals: 2 }, example: 94120 },
    { key: "change24h", label: "First coin change 24h %", type: "number", format: percent, example: -2.1 },
    { key: "direction", label: "First coin up or down", type: "text", example: "down" },
    { key: "image", label: "First coin logo", type: "image", example: "" },
    { key: "gainers", label: "Top 100 gainers today", type: "list", of: coinFields, example: [] },
    { key: "losers", label: "Top 100 losers today", type: "list", of: coinFields, example: [] },
    { key: "fearGreed", label: "Fear & greed score", type: "number", format: { decimals: 0 }, example: 71 },
    { key: "fearGreedLabel", label: "Fear & greed mood", type: "text", example: "Greed" },
  ],
  async load(params) {
    const currency = params.currency || "usd";
    const ids = (params.coins || "bitcoin").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean).join(",");
    const read = (c: any) => {
      const change24 = num(c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h);
      return {
        name: c.name ?? "",
        symbol: String(c.symbol ?? "").toUpperCase(),
        price: num(c.current_price),
        change1h: num(c.price_change_percentage_1h_in_currency),
        change24h: change24,
        change7d: num(c.price_change_percentage_7d_in_currency),
        change30d: num(c.price_change_percentage_30d_in_currency),
        change1y: num(c.price_change_percentage_1y_in_currency),
        direction: change24 >= 0 ? "up" : "down",
        arrow: change24 >= 0 ? "▲" : "▼",
        marketCap: num(c.market_cap),
        rank: num(c.market_cap_rank),
        volume: num(c.total_volume),
        high24h: num(c.high_24h),
        low24h: num(c.low_24h),
        ath: num(c.ath),
        athPct: num(c.ath_change_percentage),
        image: c.image ?? "",
      };
    };

    const base = "https://api.coingecko.com/api/v3/coins/markets";
    const extras = "price_change_percentage=1h,24h,7d,30d,1y";
    const coins = (await fetchJson(`${base}?vs_currency=${currency}&ids=${ids}&${extras}`)).map(read);
    if (!coins.length) throw new Error("No coins by those names. CoinGecko uses names like “bitcoin”, not “BTC”.");

    const [allResult, moodResult] = await Promise.allSettled([
      fetchJson(`${base}?vs_currency=${currency}&order=market_cap_desc&per_page=100&page=1&${extras}`),
      fetchJson("https://api.alternative.me/fng/?limit=1"),
    ]);
    const all = allResult.status === "fulfilled" ? allResult.value.map(read) : [];
    const sorted = [...all].sort((a, b) => b.change24h - a.change24h);
    const mood = moodResult.status === "fulfilled" ? moodResult.value.data?.[0] : null;

    return {
      coins,
      name: coins[0].name,
      price: coins[0].price,
      change24h: coins[0].change24h,
      direction: coins[0].direction,
      image: coins[0].image,
      gainers: sorted.slice(0, 8),
      losers: sorted.slice(-8).reverse(),
      fearGreed: num(mood?.value),
      fearGreedLabel: mood?.value_classification ?? "",
    };
  },
};

const rateFields: FieldDef[] = [
  { key: "code", label: "Currency", type: "text", example: "EUR" },
  { key: "rate", label: "Rate", type: "number", format: { decimals: 4 }, example: 0.8726 },
  { key: "inverse", label: "The other way round", type: "number", format: { decimals: 4 }, example: 1.146 },
  { key: "changePct", label: "Change since yesterday %", type: "number", format: percent, example: 0.12 },
];

export const currencySource: SourceKind = {
  kind: "currency",
  label: "Exchange rates",
  description: "What one currency is worth in others, and how that moved since yesterday.",
  icon: "refresh",
  group: "Markets",
  refreshSec: 3600,
  params: [
    { key: "base", label: "From", kind: "text", placeholder: "USD", default: "USD" },
    { key: "quotes", label: "To", kind: "text", hint: "One or more, comma separated.", placeholder: "EUR, GBP, JPY", default: "EUR, GBP, JPY" },
  ],
  fields: [
    { key: "base", label: "From currency", type: "text", example: "USD" },
    { key: "code", label: "First currency", type: "text", example: "EUR" },
    { key: "rate", label: "First rate", type: "number", format: { decimals: 4 }, example: 0.8726 },
    { key: "inverse", label: "First rate, reversed", type: "number", format: { decimals: 4 }, example: 1.146 },
    { key: "changePct", label: "First rate change %", type: "number", format: percent, example: 0.12 },
    { key: "rates", label: "All rates", type: "list", of: rateFields, example: [] },
    { key: "date", label: "Rates from", type: "time", format: { pattern: "DD MMM" }, example: "2026-09-18" },
  ],
  async load(params) {
    const base = (params.base || "USD").trim().toUpperCase();
    const quotes = (params.quotes || "EUR").split(",").map((q) => q.trim().toUpperCase()).filter(Boolean).join(",");
    const today = await fetchJson(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quotes}`);

    let previous: Record<string, number> = {};
    try {
      const day = new Date();
      day.setDate(day.getDate() - 7);
      const past = await fetchJson(`https://api.frankfurter.dev/v1/${day.toISOString().slice(0, 10)}?base=${base}&symbols=${quotes}`);
      previous = past.rates ?? {};
    } catch {
      // Without last week's rates the change reads zero, which is better than failing.
    }

    const rates = Object.entries(today.rates ?? {}).map(([code, value]) => {
      const rate = num(value);
      const before = num(previous[code], rate);
      return { code, rate, inverse: rate ? 1 / rate : 0, changePct: before ? ((rate - before) / before) * 100 : 0 };
    });
    if (!rates.length) throw new Error("No rates came back. Check the currency codes.");

    return { base, rates, ...rates[0], date: today.date ?? "" };
  },
};
