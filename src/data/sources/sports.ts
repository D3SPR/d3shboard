import type { SourceKind } from "../types";
import { fetchJson, num } from "./shared.ts";

const LEAGUES = [
  { value: "football/nfl", label: "NFL" },
  { value: "football/college-football", label: "College football" },
  { value: "basketball/nba", label: "NBA" },
  { value: "basketball/wnba", label: "WNBA" },
  { value: "basketball/mens-college-basketball", label: "College basketball" },
  { value: "baseball/mlb", label: "MLB" },
  { value: "hockey/nhl", label: "NHL" },
  { value: "soccer/eng.1", label: "Premier League" },
  { value: "soccer/usa.1", label: "MLS" },
  { value: "soccer/uefa.champions", label: "Champions League" },
];

const gameFields = [
  { key: "home", label: "Home team", type: "text" as const, example: "Bucks" },
  { key: "away", label: "Away team", type: "text" as const, example: "Bulls" },
  { key: "homeShort", label: "Home, short", type: "text" as const, example: "MIL" },
  { key: "awayShort", label: "Away, short", type: "text" as const, example: "CHI" },
  { key: "homeScore", label: "Home score", type: "number" as const, format: { decimals: 0 }, example: 104 },
  { key: "awayScore", label: "Away score", type: "number" as const, format: { decimals: 0 }, example: 98 },
  { key: "homeLogo", label: "Home badge", type: "image" as const, example: "" },
  { key: "awayLogo", label: "Away badge", type: "image" as const, example: "" },
  { key: "status", label: "Status", type: "text" as const, hint: 'e.g. "Q3 4:12", "Final", "Sat 7:30 PM".', example: "Q3 4:12" },
  { key: "startsAt", label: "Starts at", type: "time" as const, format: { relative: true }, example: "2026-09-19T23:30:00Z" },
  { key: "isLive", label: "Live now", type: "text" as const, example: "yes" },
  { key: "matchup", label: "Matchup", type: "text" as const, example: "CHI at MIL" },
];

type Game = Record<string, string | number>;

const readGame = (event: any): Game => {
  const comp = event.competitions?.[0] ?? {};
  const sides = comp.competitors ?? [];
  const home = sides.find((c: any) => c.homeAway === "home") ?? sides[0] ?? {};
  const away = sides.find((c: any) => c.homeAway === "away") ?? sides[1] ?? {};
  const state = event.status?.type?.state ?? "pre";
  const team = (c: any) => c.team ?? {};
  return {
    home: team(home).shortDisplayName ?? team(home).displayName ?? "",
    away: team(away).shortDisplayName ?? team(away).displayName ?? "",
    homeShort: team(home).abbreviation ?? "",
    awayShort: team(away).abbreviation ?? "",
    homeScore: num(home.score),
    awayScore: num(away.score),
    homeLogo: team(home).logo ?? "",
    awayLogo: team(away).logo ?? "",
    status: event.status?.type?.shortDetail ?? "",
    startsAt: event.date ?? "",
    isLive: state === "in" ? "yes" : "no",
    matchup: `${team(away).abbreviation ?? ""} at ${team(home).abbreviation ?? ""}`,
    state,
  };
};

// Stand-ins so library previews look real before a league is chosen.
const exampleGames = (state: string) =>
  [
    ["Bucks", "Bulls", "MIL", "CHI", 104, 98],
    ["Celtics", "Heat", "BOS", "MIA", 88, 91],
    ["Nuggets", "Suns", "DEN", "PHX", 77, 72],
  ].map(([home, away, homeShort, awayShort, homeScore, awayScore]) => ({
    home,
    away,
    homeShort,
    awayShort,
    homeScore: state === "pre" ? 0 : homeScore,
    awayScore: state === "pre" ? 0 : awayScore,
    homeLogo: "",
    awayLogo: "",
    status: state === "in" ? "Q3 4:12" : state === "post" ? "Final" : "Tonight 7:30 PM",
    startsAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
    isLive: state === "in" ? "yes" : "no",
    matchup: `${awayShort} at ${homeShort}`,
    state,
  }));

export const sportsSource: SourceKind = {
  kind: "sports",
  label: "Sports scores",
  description: "Live scores, upcoming games and final results for a league.",
  icon: "trophy",
  refreshSec: 120,
  params: [
    { key: "league", label: "League", kind: "select", default: "basketball/nba", options: LEAGUES },
    {
      key: "team",
      label: "Favourite team",
      kind: "text",
      hint: 'Optional. A short team code like MIL or GB — its game is pulled out as "My team".',
      placeholder: "Any team",
      default: "",
    },
  ],
  fields: [
    { key: "league", label: "League name", type: "text", example: "NBA" },
    { key: "live", label: "Live now", type: "list", of: gameFields, example: exampleGames("in") },
    { key: "upcoming", label: "Coming up", type: "list", of: gameFields, example: exampleGames("pre") },
    { key: "recent", label: "Final scores", type: "list", of: gameFields, example: exampleGames("post") },
    { key: "all", label: "Every game today", type: "list", of: gameFields, example: exampleGames("in") },
    { key: "myTeam", label: "My team's game", type: "list", of: gameFields, hint: "Empty unless a favourite team is set.", example: exampleGames("in").slice(0, 1) },
    { key: "liveCount", label: "How many are live", type: "number", format: { decimals: 0 }, example: 3 },
  ],
  async load(params) {
    const league = params.league || "basketball/nba";
    const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard`);
    const games = (data.events ?? []).map(readGame);
    const team = (params.team || "").trim().toUpperCase();
    return {
      league: data.leagues?.[0]?.abbreviation ?? LEAGUES.find((l) => l.value === league)?.label ?? "",
      live: games.filter((g: Game) => g.state === "in"),
      upcoming: games.filter((g: Game) => g.state === "pre"),
      recent: games.filter((g: Game) => g.state === "post"),
      all: games,
      myTeam: team ? games.filter((g: Game) => g.homeShort === team || g.awayShort === team) : [],
      liveCount: games.filter((g: Game) => g.state === "in").length,
    };
  },
};
