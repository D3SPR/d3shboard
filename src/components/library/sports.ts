import { bind, col, image, item, param, repeat, row, spacer, text, when } from "../nodes.ts";
import type { ComponentDef } from "../types";

const needs = [{ key: "sports", kind: "sports", label: "Sports scores" }];

const countParam = { key: "count", label: "How many games", kind: "number" as const, default: 4 };

/** One game as a line: away badge and code, score, home badge and code. */
const scoreLine = (withScores: boolean) =>
  row(
    [
      image(item("awayLogo"), { size: 1.2 }),
      text(item("awayShort"), { size: "sm", weight: 600 }),
      spacer,
      ...(withScores
        ? [
            text(item("awayScore"), { size: "md", weight: 700 }),
            text("–", { size: "sm", color: "muted" }),
            text(item("homeScore"), { size: "md", weight: 700 }),
          ]
        : [text(item("status"), { size: "xs", color: "muted" })]),
      spacer,
      text(item("homeShort"), { size: "sm", weight: 600 }),
      image(item("homeLogo"), { size: 1.2 }),
    ],
    { gap: 0.4 },
  );

const standings = [{ key: "standings", kind: "standings", label: "League table" }];

export const SPORTS_COMPONENTS: ComponentDef[] = [
  {
    id: "sports.detail",
    name: "Game in detail",
    description: "One game with the score, quarter, clock, venue and records.",
    icon: "trophy",
    category: "Sports",
    size: { w: 400, h: 260 },
    needs,
    root: col(
      [
        row([
          when(bind("sports", "anyLive"), text("● LIVE", { size: "xs", weight: 700, color: "negative" }), { is: "yes" }),
          spacer,
          text(bind("sports", "broadcast"), { size: "xs", color: "muted" }),
        ], { gap: 0.4 }),
        row(
          [
            col([image(bind("sports", "awayLogo"), { size: 1.8 }), text(bind("sports", "awayShort"), { size: "xs", color: "muted" }), text(bind("sports", "awayScore"), { size: "2xl", weight: 700 })], { gap: 0.15, align: "center", grow: true }),
            col([text(bind("sports", "periodLabel"), { size: "sm", color: "accent", weight: 700 }), text(bind("sports", "clock"), { size: "sm", color: "muted" })], { gap: 0.1, align: "center" }),
            col([image(bind("sports", "homeLogo"), { size: 1.8 }), text(bind("sports", "homeShort"), { size: "xs", color: "muted" }), text(bind("sports", "homeScore"), { size: "2xl", weight: 700 })], { gap: 0.15, align: "center", grow: true }),
          ],
          { gap: 0.5, justify: "center" },
        ),
        text(bind("sports", "venue"), { size: "xs", color: "muted" }),
      ],
      { gap: 0.4, align: "center", justify: "center" },
    ),
  },
  {
    id: "standings.table",
    name: "League table",
    description: "Every team with wins, losses and streak.",
    icon: "trophy",
    category: "Sports",
    size: { w: 400, h: 300 },
    needs: standings,
    params: [{ key: "count", label: "How many teams", kind: "number", default: 8 }],
    root: col(
      [
        text(bind("standings", "league"), { size: "xs", color: "accent", caps: true, weight: 700 }),
        repeat(
          "standings",
          "teams",
          row([
            text(item("rank"), { size: "xs", color: "muted" }),
            image(item("logo"), { size: 1.1 }),
            text(item("team"), { size: "sm", grow: true, lines: 1 }),
            spacer,
            text(item("record"), { size: "sm", weight: 600 }),
            text(item("streak"), { size: "xs", color: "muted" }),
          ], { gap: 0.4 }),
          { gap: 0.5, limit: param("count"), empty: "No table right now." },
        ),
      ],
      { gap: 0.45 },
    ),
  },
  {
    id: "f1.next",
    name: "Next grand prix",
    description: "The next Formula 1 race and the countdown to lights out.",
    icon: "trophy",
    category: "Sports",
    size: { w: 360, h: 210 },
    needs: [{ key: "f1", kind: "f1", label: "Formula 1" }],
    root: col(
      [
        text("Next race", { size: "xs", color: "accent", caps: true, weight: 600 }),
        text(bind("f1", "nextRace"), { size: "lg", weight: 700, lines: 2 }),
        text(bind("f1", "circuit"), { size: "xs", color: "muted", lines: 1 }),
        text(bind("f1", "startsAt"), { size: "sm", color: "accent" }),
      ],
      { gap: 0.2, justify: "center" },
    ),
  },
  {
    id: "f1.standings",
    name: "F1 championship",
    description: "The drivers' championship, points and all.",
    icon: "trophy",
    category: "Sports",
    size: { w: 340, h: 280 },
    needs: [{ key: "f1", kind: "f1", label: "Formula 1" }],
    params: [{ key: "count", label: "How many drivers", kind: "number", default: 6 }],
    root: repeat(
      "f1",
      "standings",
      row([
        text(item("position"), { size: "xs", color: "muted" }),
        text(item("driver"), { size: "sm", weight: 600, grow: true }),
        text(item("team"), { size: "xs", color: "muted", lines: 1 }),
        spacer,
        text(item("points"), { size: "sm", weight: 700 }),
      ], { gap: 0.4 }),
      { gap: 0.5, limit: param("count"), empty: "No standings yet." },
    ),
  },
  {
    id: "sports.live",
    name: "Live scores",
    description: "Games being played right now, with the score and the clock.",
    icon: "trophy",
    category: "Sports",
    size: { w: 420, h: 260 },
    needs,
    params: [countParam],
    root: col(
      [
        row([text("Live now", { size: "xs", color: "accent", caps: true, weight: 600 }), spacer, text(bind("sports", "league"), { size: "xs", color: "muted" })]),
        repeat(
          "sports",
          "live",
          col([scoreLine(true), text(item("status"), { size: "xs", color: "muted" })], { gap: 0.15 }),
          { gap: 0.7, limit: param("count"), empty: "No games on right now." },
        ),
      ],
      { gap: 0.5 },
    ),
  },
  {
    id: "sports.next",
    name: "Next game",
    description: "The next game in the league and when it starts.",
    icon: "timer",
    category: "Sports",
    size: { w: 360, h: 190 },
    needs,
    root: repeat(
      "sports",
      "upcoming",
      col(
        [
          text(item("matchup"), { size: "lg", weight: 700 }),
          text(item("status"), { size: "sm", color: "muted" }),
          text(item("startsAt"), { size: "sm", color: "accent" }),
        ],
        { gap: 0.25, align: "center" },
      ),
      { limit: "1", empty: "Nothing scheduled." },
    ),
  },
  {
    id: "sports.today",
    name: "Today's games",
    description: "Everything on today, live or not.",
    icon: "trophy",
    category: "Sports",
    size: { w: 420, h: 300 },
    needs,
    params: [{ ...countParam, default: 5 }],
    root: repeat(
      "sports",
      "all",
      when(item("isLive"), scoreLine(true), { is: "yes", else: scoreLine(false) }),
      { gap: 0.7, limit: param("count"), empty: "No games today." },
    ),
  },
  {
    id: "sports.myteam",
    name: "My team",
    description: "Your team's game, with a live badge when it's on.",
    icon: "trophy",
    category: "Sports",
    size: { w: 380, h: 220 },
    needs: [{ key: "sports", kind: "sports", label: "Sports scores (set a favourite team)" }],
    root: repeat(
      "sports",
      "myTeam",
      col(
        [
          when(item("isLive"), text("● Live", { size: "xs", color: "negative", weight: 700, caps: true }), { is: "yes" }),
          row(
            [
              col([text(item("awayShort"), { size: "sm", color: "muted" }), text(item("awayScore"), { size: "2xl", weight: 700 })], { gap: 0.1, align: "center", grow: true }),
              text("–", { size: "lg", color: "muted" }),
              col([text(item("homeShort"), { size: "sm", color: "muted" }), text(item("homeScore"), { size: "2xl", weight: 700 })], { gap: 0.1, align: "center", grow: true }),
            ],
            { gap: 0.5, justify: "center" },
          ),
          text(item("status"), { size: "sm", color: "muted" }),
        ],
        { gap: 0.3, align: "center" },
      ),
      { limit: "1", empty: "Set a favourite team under Add → Data." },
    ),
  },
];
