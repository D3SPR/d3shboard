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
  { key: "period", label: "Quarter / period / inning", type: "number" as const, format: { decimals: 0 }, example: 3 },
  { key: "periodLabel", label: "Quarter, in words", type: "text" as const, example: "Q3" },
  { key: "clock", label: "Time on the clock", type: "text" as const, example: "4:12" },
  { key: "homeRecord", label: "Home record", type: "text" as const, example: "41-18" },
  { key: "awayRecord", label: "Away record", type: "text" as const, example: "33-26" },
  { key: "homeRank", label: "Home ranking", type: "number" as const, format: { decimals: 0 }, example: 0 },
  { key: "awayRank", label: "Away ranking", type: "number" as const, format: { decimals: 0 }, example: 0 },
  { key: "venue", label: "Venue", type: "text" as const, example: "Fiserv Forum" },
  { key: "city", label: "City", type: "text" as const, example: "Milwaukee" },
  { key: "broadcast", label: "On TV", type: "text" as const, example: "ESPN" },
  { key: "lastPlay", label: "Last play", type: "text" as const, example: "Giannis makes 2-pt layup" },
  { key: "note", label: "Series note", type: "text" as const, example: "Game 4, series tied 2-2" },
  { key: "homeColor", label: "Home colour", type: "text" as const, example: "#00471B" },
  { key: "awayColor", label: "Away colour", type: "text" as const, example: "#CE1141" },
  { key: "leader", label: "Who's ahead", type: "text" as const, example: "MIL" },
  { key: "margin", label: "Points between them", type: "number" as const, format: { decimals: 0 }, example: 6 },
];

/** "Q3", "P2", "Top 5th", "2H" — whatever that sport calls it. */
const periodLabelFor = (league: string, period: number, shortDetail: string) => {
  if (!period) return "";
  if (league.startsWith("baseball")) return shortDetail || `Inning ${period}`;
  if (league.startsWith("hockey")) return period > 3 ? "OT" : `P${period}`;
  if (league.startsWith("soccer")) return period > 1 ? "2nd half" : "1st half";
  return period > 4 ? "OT" : `Q${period}`;
};

type Game = Record<string, string | number>;

const readGame = (event: any, league: string): Game => {
  const comp = event.competitions?.[0] ?? {};
  const sides = comp.competitors ?? [];
  const home = sides.find((c: any) => c.homeAway === "home") ?? sides[0] ?? {};
  const away = sides.find((c: any) => c.homeAway === "away") ?? sides[1] ?? {};
  const state = event.status?.type?.state ?? "pre";
  const team = (c: any) => c.team ?? {};
  const period = num(event.status?.period);
  const shortDetail = event.status?.type?.shortDetail ?? "";
  const homeScore = num(home.score);
  const awayScore = num(away.score);
  const ahead = homeScore === awayScore ? "" : homeScore > awayScore ? team(home).abbreviation ?? "" : team(away).abbreviation ?? "";
  return {
    home: team(home).shortDisplayName ?? team(home).displayName ?? "",
    away: team(away).shortDisplayName ?? team(away).displayName ?? "",
    homeShort: team(home).abbreviation ?? "",
    awayShort: team(away).abbreviation ?? "",
    homeScore,
    awayScore,
    homeLogo: team(home).logo ?? "",
    awayLogo: team(away).logo ?? "",
    status: event.status?.type?.shortDetail ?? "",
    startsAt: event.date ?? "",
    isLive: state === "in" ? "yes" : "no",
    matchup: `${team(away).abbreviation ?? ""} at ${team(home).abbreviation ?? ""}`,
    period,
    periodLabel: state === "in" ? periodLabelFor(league, period, shortDetail) : "",
    clock: event.status?.displayClock ?? "",
    homeRecord: home.records?.[0]?.summary ?? "",
    awayRecord: away.records?.[0]?.summary ?? "",
    homeRank: num(home.curatedRank?.current) === 99 ? 0 : num(home.curatedRank?.current),
    awayRank: num(away.curatedRank?.current) === 99 ? 0 : num(away.curatedRank?.current),
    venue: comp.venue?.fullName ?? "",
    city: comp.venue?.address?.city ?? "",
    broadcast: comp.broadcasts?.[0]?.names?.[0] ?? comp.geoBroadcasts?.[0]?.media?.shortName ?? "",
    lastPlay: comp.situation?.lastPlay?.text ?? comp.situation?.downDistanceText ?? "",
    note: comp.notes?.[0]?.headline ?? event.notes?.[0]?.headline ?? "",
    homeColor: team(home).color ? `#${team(home).color}` : "",
    awayColor: team(away).color ? `#${team(away).color}` : "",
    leader: ahead,
    margin: Math.abs(homeScore - awayScore),
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
    period: 3,
    periodLabel: state === "in" ? "Q3" : "",
    clock: state === "in" ? "4:12" : "",
    homeRecord: "41-18",
    awayRecord: "33-26",
    homeRank: 0,
    awayRank: 0,
    venue: "Fiserv Forum",
    city: "Milwaukee",
    broadcast: "ESPN",
    lastPlay: "",
    note: "",
    homeColor: "#00471B",
    awayColor: "#CE1141",
    leader: homeShort,
    margin: 6,
    state,
  }));

export const sportsSource: SourceKind = {
  kind: "sports",
  label: "Sports scores",
  description: "Live scores, upcoming games and final results for a league.",
  icon: "trophy",
  group: "Sports",
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
    { key: "anyLive", label: "Anything on right now", type: "text", hint: '"yes" or "no".', example: "yes" },
    { key: "homeShort", label: "Featured game — home code", type: "text", example: "MIL" },
    { key: "awayShort", label: "Featured game — away code", type: "text", example: "CHI" },
    { key: "homeScore", label: "Featured game — home score", type: "number", format: { decimals: 0 }, example: 104 },
    { key: "awayScore", label: "Featured game — away score", type: "number", format: { decimals: 0 }, example: 98 },
    { key: "homeLogo", label: "Featured game — home badge", type: "image", example: "" },
    { key: "awayLogo", label: "Featured game — away badge", type: "image", example: "" },
    { key: "status", label: "Featured game — status", type: "text", example: "Q3 4:12" },
    { key: "periodLabel", label: "Featured game — quarter", type: "text", example: "Q3" },
    { key: "clock", label: "Featured game — clock", type: "text", example: "4:12" },
    { key: "matchup", label: "Featured game — matchup", type: "text", example: "CHI at MIL" },
    { key: "startsAt", label: "Featured game — starts", type: "time", format: { relative: true }, example: "2026-09-20T23:30:00Z" },
    { key: "venue", label: "Featured game — venue", type: "text", example: "Fiserv Forum" },
    { key: "broadcast", label: "Featured game — on TV", type: "text", example: "ESPN" },
  ],
  async load(params) {
    const league = params.league || "basketball/nba";
    const data = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard`);
    const games = (data.events ?? []).map((e: any) => readGame(e, league));
    const team = (params.team || "").trim().toUpperCase();
    const live = games.filter((g: Game) => g.state === "in");
    const upcoming = games.filter((g: Game) => g.state === "pre");
    const mine = team ? games.filter((g: Game) => g.homeShort === team || g.awayShort === team) : [];
    // The featured game is your team's if you named one, else whatever is live, else what's next.
    const featured = mine[0] ?? live[0] ?? upcoming[0] ?? games[0] ?? {};
    return {
      league: data.leagues?.[0]?.abbreviation ?? LEAGUES.find((l) => l.value === league)?.label ?? "",
      live,
      upcoming,
      recent: games.filter((g: Game) => g.state === "post"),
      all: games,
      myTeam: mine,
      liveCount: live.length,
      anyLive: live.length ? "yes" : "no",
      homeShort: featured.homeShort ?? "",
      awayShort: featured.awayShort ?? "",
      homeScore: featured.homeScore ?? 0,
      awayScore: featured.awayScore ?? 0,
      homeLogo: featured.homeLogo ?? "",
      awayLogo: featured.awayLogo ?? "",
      status: featured.status ?? "",
      periodLabel: featured.periodLabel ?? "",
      clock: featured.clock ?? "",
      matchup: featured.matchup ?? "",
      startsAt: featured.startsAt ?? "",
      venue: featured.venue ?? "",
      broadcast: featured.broadcast ?? "",
    };
  },
};
