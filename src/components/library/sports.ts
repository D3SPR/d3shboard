import { bind, col, image, item, param, repeat, row, spacer, text, when } from "../nodes";
import type { ComponentDef } from "../types";

const needs = [{ key: "sports", kind: "sports", label: "Sports scores" }];

const countParam = { key: "count", label: "How many games", kind: "number" as const, min: 1, max: 10, default: 4 };

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

export const SPORTS_COMPONENTS: ComponentDef[] = [
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
      { limit: "1", empty: "Set a favourite team in the Data menu." },
    ),
  },
];
