import type { SourceKind } from "../types";
import { fetchJson } from "./shared";

const itemFields = [
  { key: "title", label: "Headline", type: "text" as const, example: "Something happened somewhere" },
  { key: "source", label: "Publication", type: "text" as const, example: "BBC News" },
  { key: "time", label: "Published", type: "time" as const, format: { relative: true }, example: "2026-09-19T17:10:00Z" },
  { key: "image", label: "Picture", type: "image" as const, example: "" },
  { key: "link", label: "Link", type: "text" as const, example: "https://example.com/story" },
];

const exampleItems = [
  "Talks continue into a second week",
  "City approves the new lakefront plan",
  "Scientists find something unexpected",
  "Late goal settles the derby",
  "Markets close higher for a third day",
].map((title, i) => ({
  title,
  source: "BBC News",
  time: new Date(Date.now() - (i + 1) * 23 * 60_000).toISOString(),
  image: "",
  link: "",
}));

export const newsSource: SourceKind = {
  kind: "news",
  label: "News headlines",
  description: "Headlines from any news site or blog that offers a feed.",
  icon: "news",
  refreshSec: 900,
  params: [
    {
      key: "url",
      label: "Feed",
      kind: "text",
      hint: "Pick one of these or paste the address of any RSS feed.",
      placeholder: "https://…",
      default: "https://feeds.bbci.co.uk/news/rss.xml",
      options: [
        { value: "https://feeds.bbci.co.uk/news/rss.xml", label: "BBC News" },
        { value: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", label: "New York Times" },
        { value: "https://www.theverge.com/rss/index.xml", label: "The Verge" },
        { value: "https://feeds.arstechnica.com/arstechnica/index", label: "Ars Technica" },
        { value: "https://www.espn.com/espn/rss/news", label: "ESPN" },
        { value: "https://feeds.npr.org/1001/rss.xml", label: "NPR" },
      ],
    },
  ],
  fields: [
    { key: "items", label: "Headlines", type: "list", of: itemFields, example: exampleItems },
    { key: "top", label: "Top headline", type: "text", example: "Something happened somewhere" },
    { key: "source", label: "Publication", type: "text", example: "BBC News" },
    { key: "updated", label: "Last updated", type: "time", format: { relative: true }, example: "2026-09-19T17:10:00Z" },
  ],
  async load(params) {
    const url = params.url || "https://feeds.bbci.co.uk/news/rss.xml";
    const data = await fetchJson(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
    if (!Array.isArray(data.items)) throw new Error(data.message || "That feed didn't return any headlines.");
    const source = data.feed?.title ?? "";
    const items = data.items.slice(0, 12).map((item: any) => ({
      title: item.title ?? "",
      source,
      time: item.pubDate ? item.pubDate.replace(" ", "T") : "",
      image: item.thumbnail || item.enclosure?.link || "",
      link: item.link ?? "",
    }));
    return { items, top: items[0]?.title ?? "", source, updated: new Date().toISOString() };
  },
};
