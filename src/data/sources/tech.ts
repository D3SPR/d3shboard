import type { FieldDef, SourceKind } from "../types";
import { fetchJson, num } from "./shared.ts";

const storyFields: FieldDef[] = [
  { key: "title", label: "Title", type: "text", example: "Show HN: I built a dashboard" },
  { key: "points", label: "Points", type: "number", format: { decimals: 0 }, example: 412 },
  { key: "comments", label: "Comments", type: "number", format: { decimals: 0 }, example: 138 },
  { key: "author", label: "Posted by", type: "text", example: "pg" },
  { key: "site", label: "Site", type: "text", example: "example.com" },
  { key: "time", label: "Posted", type: "time", format: { relative: true }, example: "2026-09-20T08:00:00Z" },
  { key: "link", label: "Link", type: "text", example: "" },
];

export const hackerNewsSource: SourceKind = {
  kind: "hackerNews",
  label: "Hacker News",
  description: "What the tech crowd is reading, with points and comment counts.",
  icon: "code",
  group: "News & web",
  refreshSec: 900,
  params: [
    {
      key: "kind",
      label: "Which stories",
      kind: "select",
      default: "front_page",
      options: [
        { value: "front_page", label: "Front page" },
        { value: "story", label: "Newest" },
        { value: "ask_hn", label: "Ask HN" },
        { value: "show_hn", label: "Show HN" },
      ],
    },
  ],
  fields: [
    { key: "stories", label: "Stories", type: "list", of: storyFields, example: [] },
    { key: "topTitle", label: "Top story", type: "text", example: "Show HN: I built a dashboard" },
    { key: "topPoints", label: "Top story points", type: "number", format: { decimals: 0 }, example: 412 },
    { key: "topComments", label: "Top story comments", type: "number", format: { decimals: 0 }, example: 138 },
    { key: "topLink", label: "Top story link", type: "text", example: "" },
  ],
  async load(params) {
    const tag = params.kind || "front_page";
    const data = await fetchJson(`https://hn.algolia.com/api/v1/search?tags=${tag}&hitsPerPage=12`);
    const stories = (data.hits ?? []).map((h: any) => {
      let site = "";
      try {
        site = h.url ? new URL(h.url).hostname.replace(/^www\./, "") : "news.ycombinator.com";
      } catch {
        site = "";
      }
      return {
        title: h.title ?? h.story_title ?? "",
        points: num(h.points),
        comments: num(h.num_comments),
        author: h.author ?? "",
        site,
        time: h.created_at ?? "",
        link: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      };
    });
    if (!stories.length) throw new Error("Hacker News returned no stories.");
    return {
      stories,
      topTitle: stories[0].title,
      topPoints: stories[0].points,
      topComments: stories[0].comments,
      topLink: stories[0].link,
    };
  },
};

export const githubSource: SourceKind = {
  kind: "github",
  label: "GitHub project",
  description: "Stars, forks, open issues and the latest release of any public repository.",
  icon: "code",
  group: "News & web",
  refreshSec: 1800,
  params: [
    { key: "repo", label: "Repository", kind: "text", hint: "Written as owner/name.", placeholder: "facebook/react", default: "facebook/react" },
  ],
  fields: [
    { key: "name", label: "Name", type: "text", example: "react" },
    { key: "owner", label: "Owner", type: "text", example: "facebook" },
    { key: "description", label: "Description", type: "text", example: "The library for web and native user interfaces." },
    { key: "stars", label: "Stars", type: "number", format: { decimals: 0 }, example: 228000 },
    { key: "forks", label: "Forks", type: "number", format: { decimals: 0 }, example: 46500 },
    { key: "openIssues", label: "Open issues", type: "number", format: { decimals: 0 }, example: 980 },
    { key: "watchers", label: "Watchers", type: "number", format: { decimals: 0 }, example: 6700 },
    { key: "language", label: "Main language", type: "text", example: "JavaScript" },
    { key: "latestRelease", label: "Latest release", type: "text", example: "v19.2.0" },
    { key: "releaseDate", label: "Released", type: "time", format: { relative: true }, example: "2026-08-12T00:00:00Z" },
    { key: "pushedAt", label: "Last push", type: "time", format: { relative: true }, example: "2026-09-19T00:00:00Z" },
    { key: "avatar", label: "Owner picture", type: "image", example: "" },
  ],
  async load(params) {
    const repo = (params.repo || "facebook/react").trim().replace(/^https?:\/\/github\.com\//, "");
    const data = await fetchJson(`https://api.github.com/repos/${repo}`);
    if (data.message) throw new Error(`GitHub said: ${data.message}`);

    let release: any = {};
    try {
      release = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
    } catch {
      // Plenty of repositories have no releases; the rest of the numbers still work.
    }

    return {
      name: data.name ?? "",
      owner: data.owner?.login ?? "",
      description: data.description ?? "",
      stars: num(data.stargazers_count),
      forks: num(data.forks_count),
      openIssues: num(data.open_issues_count),
      watchers: num(data.subscribers_count),
      language: data.language ?? "",
      latestRelease: release.tag_name ?? "",
      releaseDate: release.published_at ?? "",
      pushedAt: data.pushed_at ?? "",
      avatar: data.owner?.avatar_url ?? "",
    };
  },
};
