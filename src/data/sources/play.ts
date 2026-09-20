import type { FieldDef, SourceKind } from "../types";
import { decodeEntities, fetchJson, num } from "./shared.ts";

const LEAGUES = [
  { value: "football/nfl", label: "NFL" },
  { value: "basketball/nba", label: "NBA" },
  { value: "basketball/wnba", label: "WNBA" },
  { value: "baseball/mlb", label: "MLB" },
  { value: "hockey/nhl", label: "NHL" },
  { value: "soccer/eng.1", label: "Premier League" },
  { value: "soccer/usa.1", label: "MLS" },
];

const standingFields: FieldDef[] = [
  { key: "rank", label: "Position", type: "number", format: { decimals: 0 }, example: 1 },
  { key: "team", label: "Team", type: "text", example: "Bucks" },
  { key: "short", label: "Team, short", type: "text", example: "MIL" },
  { key: "logo", label: "Badge", type: "image", example: "" },
  { key: "wins", label: "Wins", type: "number", format: { decimals: 0 }, example: 41 },
  { key: "losses", label: "Losses", type: "number", format: { decimals: 0 }, example: 18 },
  { key: "record", label: "Record", type: "text", example: "41-18" },
  { key: "pct", label: "Win rate", type: "number", format: { decimals: 3 }, example: 0.695 },
  { key: "gamesBehind", label: "Games behind", type: "number", format: { decimals: 1 }, example: 0 },
  { key: "streak", label: "Streak", type: "text", example: "W4" },
];

export const standingsSource: SourceKind = {
  kind: "standings",
  label: "League table",
  description: "Where every team sits: wins, losses, win rate, games behind and current streak.",
  icon: "trophy",
  group: "Sports",
  refreshSec: 3600,
  params: [
    { key: "league", label: "League", kind: "select", default: "basketball/nba", options: LEAGUES },
    { key: "team", label: "Your team", kind: "text", hint: "Optional short code like MIL — pulled out as “my team”.", placeholder: "Any team", default: "" },
  ],
  fields: [
    { key: "league", label: "League name", type: "text", example: "NBA" },
    { key: "teams", label: "The table", type: "list", of: standingFields, example: [] },
    { key: "leader", label: "Top team", type: "text", example: "Bucks" },
    { key: "leaderRecord", label: "Top team record", type: "text", example: "41-18" },
    { key: "myRank", label: "My team's position", type: "number", format: { decimals: 0 }, example: 3 },
    { key: "myRecord", label: "My team's record", type: "text", example: "38-21" },
    { key: "myStreak", label: "My team's streak", type: "text", example: "W4" },
  ],
  async load(params) {
    const league = params.league || "basketball/nba";
    const data = await fetchJson(`https://site.api.espn.com/apis/v2/sports/${league}/standings`);
    const entries: any[] = (data.children ?? []).flatMap((c: any) => c.standings?.entries ?? []);
    const stat = (e: any, name: string) => e.stats?.find((s: any) => s.name === name || s.abbreviation === name);

    const teams = entries
      .map((e: any) => {
        const wins = num(stat(e, "wins")?.value);
        const losses = num(stat(e, "losses")?.value);
        return {
          rank: num(stat(e, "playoffSeed")?.value ?? stat(e, "rank")?.value),
          team: e.team?.shortDisplayName ?? e.team?.displayName ?? "",
          short: e.team?.abbreviation ?? "",
          logo: e.team?.logos?.[0]?.href ?? "",
          wins,
          losses,
          record: stat(e, "overall")?.displayValue ?? `${wins}-${losses}`,
          pct: num(stat(e, "winPercent")?.value),
          gamesBehind: num(stat(e, "gamesBehind")?.value),
          streak: stat(e, "streak")?.displayValue ?? "",
        };
      })
      .sort((a, b) => (b.pct || 0) - (a.pct || 0))
      .map((t, i) => ({ ...t, rank: t.rank || i + 1 }));

    if (!teams.length) throw new Error("No table came back for that league — it may be out of season.");
    const code = (params.team || "").trim().toUpperCase();
    const mine = teams.find((t) => t.short === code);
    return {
      league: data.abbreviation ?? LEAGUES.find((l) => l.value === league)?.label ?? "",
      teams,
      leader: teams[0].team,
      leaderRecord: teams[0].record,
      myRank: mine?.rank ?? 0,
      myRecord: mine?.record ?? "",
      myStreak: mine?.streak ?? "",
    };
  },
};

const driverFields: FieldDef[] = [
  { key: "position", label: "Position", type: "number", format: { decimals: 0 }, example: 1 },
  { key: "driver", label: "Driver", type: "text", example: "Verstappen" },
  { key: "team", label: "Team", type: "text", example: "Red Bull" },
  { key: "points", label: "Points", type: "number", format: { decimals: 0 }, example: 291 },
];

export const f1Source: SourceKind = {
  kind: "f1",
  label: "Formula 1",
  description: "The next grand prix, who won the last one, and the drivers' championship.",
  icon: "trophy",
  group: "Sports",
  refreshSec: 3600,
  params: [],
  fields: [
    { key: "nextRace", label: "Next race", type: "text", example: "Singapore Grand Prix" },
    { key: "circuit", label: "Circuit", type: "text", example: "Marina Bay Street Circuit" },
    { key: "country", label: "Country", type: "text", example: "Singapore" },
    { key: "round", label: "Round", type: "number", format: { decimals: 0 }, example: 18 },
    { key: "startsAt", label: "Lights out", type: "time", format: { relative: true }, example: "2026-09-21T12:00:00Z" },
    { key: "raceDate", label: "Race date", type: "time", format: { pattern: "ddd DD MMM" }, example: "2026-09-21" },
    { key: "lastRace", label: "Last race", type: "text", example: "Azerbaijan Grand Prix" },
    { key: "lastWinner", label: "Last winner", type: "text", example: "Verstappen" },
    { key: "lastWinnerTeam", label: "Last winner's team", type: "text", example: "Red Bull" },
    { key: "leader", label: "Championship leader", type: "text", example: "Verstappen" },
    { key: "leaderPoints", label: "Leader's points", type: "number", format: { decimals: 0 }, example: 291 },
    { key: "standings", label: "Drivers' championship", type: "list", of: driverFields, example: [] },
  ],
  async load() {
    const base = "https://api.jolpi.ca/ergast/f1";
    const [nextResult, lastResult, standingsResult] = await Promise.allSettled([
      fetchJson(`${base}/current/next.json`),
      fetchJson(`${base}/current/last/results.json`),
      fetchJson(`${base}/current/driverstandings.json`),
    ]);
    if (nextResult.status === "rejected" && standingsResult.status === "rejected")
      throw new Error("The Formula 1 data service didn't answer.");

    const race = nextResult.status === "fulfilled" ? nextResult.value.MRData?.RaceTable?.Races?.[0] : null;
    const last = lastResult.status === "fulfilled" ? lastResult.value.MRData?.RaceTable?.Races?.[0] : null;
    const winner = last?.Results?.[0];
    const table =
      standingsResult.status === "fulfilled"
        ? standingsResult.value.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? []
        : [];

    const standings = table.slice(0, 10).map((d: any) => ({
      position: num(d.position),
      driver: d.Driver?.familyName ?? "",
      team: d.Constructors?.[0]?.name ?? "",
      points: num(d.points),
    }));

    return {
      nextRace: race?.raceName ?? "",
      circuit: race?.Circuit?.circuitName ?? "",
      country: race?.Circuit?.Location?.country ?? "",
      round: num(race?.round),
      startsAt: race?.date ? `${race.date}T${race.time ?? "12:00:00Z"}` : "",
      raceDate: race?.date ?? "",
      lastRace: last?.raceName ?? "",
      lastWinner: winner?.Driver?.familyName ?? "",
      lastWinnerTeam: winner?.Constructor?.name ?? "",
      leader: standings[0]?.driver ?? "",
      leaderPoints: standings[0]?.points ?? 0,
      standings,
    };
  },
};

const showFields: FieldDef[] = [
  { key: "show", label: "Show", type: "text", example: "Some Drama" },
  { key: "episode", label: "Episode", type: "text", example: "The One With The Thing" },
  { key: "network", label: "Channel", type: "text", example: "NBC" },
  { key: "time", label: "Airs at", type: "text", example: "21:00" },
  { key: "season", label: "Season", type: "number", format: { decimals: 0 }, example: 4 },
  { key: "number", label: "Episode number", type: "number", format: { decimals: 0 }, example: 7 },
  { key: "image", label: "Picture", type: "image", example: "" },
];

export const tvSource: SourceKind = {
  kind: "tv",
  label: "On TV tonight",
  description: "What's airing today, channel by channel.",
  icon: "computer",
  group: "Fun",
  refreshSec: 3600,
  params: [
    {
      key: "country",
      label: "Country",
      kind: "text",
      placeholder: "US",
      default: "US",
      options: [
        { value: "US", label: "United States" },
        { value: "GB", label: "United Kingdom" },
        { value: "CA", label: "Canada" },
        { value: "AU", label: "Australia" },
      ],
    },
    { key: "after", label: "From", kind: "text", hint: "Only shows starting after this time, as HH:MM.", placeholder: "19:00", default: "19:00" },
  ],
  fields: [
    { key: "shows", label: "What's on", type: "list", of: showFields, example: [] },
    { key: "firstShow", label: "First up", type: "text", example: "Some Drama" },
    { key: "firstTime", label: "First up at", type: "text", example: "19:00" },
    { key: "firstNetwork", label: "First up on", type: "text", example: "NBC" },
    { key: "count", label: "How many", type: "number", format: { decimals: 0 }, example: 24 },
  ],
  async load(params) {
    const country = (params.country || "US").trim().toUpperCase();
    const date = new Date().toISOString().slice(0, 10);
    const data = await fetchJson(`https://api.tvmaze.com/schedule?country=${country}&date=${date}`);
    const after = params.after || "00:00";
    const shows = (Array.isArray(data) ? data : [])
      .filter((e: any) => (e.airtime ?? "") >= after)
      .sort((a: any, b: any) => String(a.airtime).localeCompare(String(b.airtime)))
      .slice(0, 14)
      .map((e: any) => ({
        show: e.show?.name ?? "",
        episode: e.name ?? "",
        network: e.show?.network?.name ?? e.show?.webChannel?.name ?? "",
        time: e.airtime ?? "",
        season: num(e.season),
        number: num(e.number),
        image: e.show?.image?.medium ?? "",
      }));
    if (!shows.length) throw new Error("Nothing listed for today — try an earlier start time.");
    return {
      shows,
      firstShow: shows[0].show,
      firstTime: shows[0].time,
      firstNetwork: shows[0].network,
      count: shows.length,
    };
  },
};

export const funSource: SourceKind = {
  kind: "fun",
  label: "Something light",
  description: "A joke, a piece of advice and a random dog — refreshed through the day.",
  icon: "sparkles",
  group: "Fun",
  refreshSec: 1800,
  params: [],
  fields: [
    { key: "jokeSetup", label: "Joke setup", type: "text", example: "Why did the developer go broke?" },
    { key: "jokePunchline", label: "Joke punchline", type: "text", example: "Because he used up all his cache." },
    { key: "joke", label: "Joke, both lines", type: "text", example: "Why did the developer go broke? Because he used up all his cache." },
    { key: "advice", label: "Advice", type: "text", example: "Try to do the things you're incapable of." },
    { key: "picture", label: "Random dog", type: "image", example: "" },
  ],
  async load() {
    const [jokeResult, adviceResult, dogResult] = await Promise.allSettled([
      fetchJson("https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart"),
      fetchJson("https://api.adviceslip.com/advice"),
      fetchJson("https://dog.ceo/api/breeds/image/random"),
    ]);
    const joke = jokeResult.status === "fulfilled" ? jokeResult.value : {};
    const advice = adviceResult.status === "fulfilled" ? adviceResult.value : {};
    const dog = dogResult.status === "fulfilled" ? dogResult.value : {};
    if (!joke.setup && !advice.slip && !dog.message) throw new Error("None of the fun services answered.");
    return {
      jokeSetup: decodeEntities(joke.setup ?? ""),
      jokePunchline: decodeEntities(joke.delivery ?? ""),
      joke: decodeEntities([joke.setup, joke.delivery].filter(Boolean).join(" ")),
      advice: advice.slip?.advice ?? "",
      picture: dog.message ?? "",
    };
  },
};
