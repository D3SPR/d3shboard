import { bar, bind, col, icon, image, item, param, repeat, row, spacer, text } from "../nodes.ts";
import type { ComponentDef } from "../types";

const count = (label: string, def: number, max = 10) => ({ key: "count", label, kind: "number" as const, min: 1, max, default: def });

export const DISCOVER_COMPONENTS: ComponentDef[] = [
  // ── Space ────────────────────────────────────────────────────────────────
  {
    id: "space.next",
    name: "Next rocket launch",
    description: "The next launch anywhere in the world, and the countdown to it.",
    icon: "sparkles",
    category: "Space",
    size: { w: 360, h: 210 },
    needs: [{ key: "space", kind: "space", label: "Rocket launches & the ISS" }],
    root: col(
      [
        text("Next launch", { size: "xs", color: "accent", caps: true, weight: 600 }),
        text(bind("space", "nextName"), { size: "lg", weight: 700, lines: 2 }),
        text(bind("space", "nextRocket"), { size: "sm", color: "muted" }),
        text(bind("space", "nextTime"), { size: "sm", color: "accent" }),
      ],
      { gap: 0.25, justify: "center" },
    ),
  },
  {
    id: "space.schedule",
    name: "Launch schedule",
    description: "The next few launches with who's flying them.",
    icon: "sparkles",
    category: "Space",
    size: { w: 400, h: 280 },
    needs: [{ key: "space", kind: "space", label: "Rocket launches & the ISS" }],
    params: [count("How many launches", 4, 6)],
    root: repeat(
      "space",
      "launches",
      col(
        [
          text(item("name"), { size: "sm", weight: 600, lines: 1 }),
          row([text(item("provider"), { size: "xs", color: "muted", grow: true }), text(item("time"), { size: "xs", color: "accent" })], { gap: 0.4 }),
        ],
        { gap: 0.1 },
      ),
      { gap: 0.6, limit: param("count"), empty: "No launches scheduled." },
    ),
  },
  {
    id: "space.iss",
    name: "Where the ISS is",
    description: "The space station's position, altitude and speed.",
    icon: "globe",
    category: "Space",
    size: { w: 320, h: 200 },
    needs: [{ key: "space", kind: "space", label: "Rocket launches & the ISS" }],
    root: col(
      [
        row([icon("globe", { size: "lg", color: "accent" }), text("Space station", { size: "sm", weight: 600 })], { gap: 0.4, justify: "center" }),
        row([text(bind("space", "issLatitude"), { size: "md", weight: 700 }), text(bind("space", "issLongitude"), { size: "md", weight: 700 })], { gap: 0.6, justify: "center" }),
        row([text(bind("space", "issAltitude"), { size: "xs", color: "muted" }), text(bind("space", "issSpeed"), { size: "xs", color: "muted" })], { gap: 0.6, justify: "center" }),
      ],
      { gap: 0.3, align: "center", justify: "center" },
    ),
  },
  {
    id: "space.picture",
    name: "Space picture of the day",
    description: "NASA's daily picture with its title.",
    icon: "image",
    category: "Space",
    size: { w: 380, h: 320 },
    needs: [{ key: "apod", kind: "apod", label: "Space picture of the day" }],
    root: col(
      [
        image(bind("apod", "image"), { grow: true, fit: "cover", radius: 0.4 }),
        text(bind("apod", "title"), { size: "sm", weight: 600, lines: 2 }),
      ],
      { gap: 0.35 },
    ),
  },
  {
    id: "aurora.now",
    name: "Northern lights",
    description: "Geomagnetic activity and whether the aurora is worth staying up for.",
    icon: "sparkles",
    category: "Space",
    size: { w: 320, h: 190 },
    needs: [{ key: "aurora", kind: "aurora", label: "Northern lights" }],
    root: col(
      [
        text(bind("aurora", "kp", { prefix: "Kp " }), { size: "2xl", weight: 700 }),
        text(bind("aurora", "level"), { size: "sm", color: "accent", weight: 600 }),
        text(bind("aurora", "chance"), { size: "xs", color: "muted", lines: 2 }),
      ],
      { gap: 0.25, align: "center", justify: "center" },
    ),
  },
  {
    id: "quake.recent",
    name: "Recent earthquakes",
    description: "What the ground has been doing, biggest first.",
    icon: "activity",
    category: "Space",
    size: { w: 400, h: 260 },
    needs: [{ key: "quakes", kind: "earthquakes", label: "Earthquakes" }],
    params: [count("How many", 5)],
    root: col(
      [
        row([text("Earthquakes", { size: "xs", color: "muted", caps: true, weight: 600 }), spacer, text(bind("quakes", "count"), { size: "xs", color: "muted" })]),
        repeat(
          "quakes",
          "quakes",
          row([
            text(item("magnitude"), { size: "sm", weight: 700, color: "accent" }),
            text(item("place"), { size: "sm", grow: true, lines: 1 }),
            spacer,
            text(item("time"), { size: "xs", color: "muted" }),
          ], { gap: 0.45 }),
          { gap: 0.5, limit: param("count"), empty: "Nothing recorded." },
        ),
      ],
      { gap: 0.45 },
    ),
  },

  // ── Time & personal ──────────────────────────────────────────────────────
  {
    id: "countdown.big",
    name: "Countdown",
    description: "Days, hours and minutes until the date you pick.",
    icon: "timer",
    category: "Time",
    size: { w: 340, h: 200 },
    needs: [{ key: "countdown", kind: "countdown", label: "Countdown & progress" }],
    root: col(
      [
        text(bind("countdown", "label"), { size: "xs", color: "accent", caps: true, weight: 600 }),
        text(bind("countdown", "days"), { size: "3xl", weight: 700 }),
        row(
          [
            text(bind("countdown", "hours", { unit: "h" }), { size: "sm", color: "muted" }),
            text(bind("countdown", "minutes", { unit: "m" }), { size: "sm", color: "muted" }),
          ],
          { gap: 0.4, justify: "center" },
        ),
      ],
      { gap: 0.2, align: "center", justify: "center" },
    ),
  },
  {
    id: "progress.year",
    name: "Year progress",
    description: "How much of the year has gone, as a bar.",
    icon: "calendar",
    category: "Time",
    size: { w: 340, h: 160 },
    needs: [{ key: "countdown", kind: "countdown", label: "Countdown & progress" }],
    root: col(
      [
        row([text("This year", { size: "sm", color: "muted" }), spacer, text(bind("countdown", "yearPercent"), { size: "sm", weight: 700 })]),
        bar(bind("countdown", "yearPercent"), { max: "100", color: "accent" }),
        text(bind("countdown", "daysLeftInYear", { prefix: "", unit: " days left" }), { size: "xs", color: "muted" }),
      ],
      { gap: 0.4, justify: "center" },
    ),
  },
  {
    id: "holiday.next",
    name: "Next day off",
    description: "The next public holiday and how far away it is.",
    icon: "calendar",
    category: "Time",
    size: { w: 320, h: 190 },
    needs: [{ key: "holidays", kind: "holidays", label: "Public holidays" }],
    root: col(
      [
        text(bind("holidays", "nextName"), { size: "lg", weight: 700, lines: 2 }),
        text(bind("holidays", "nextDate"), { size: "sm", color: "muted" }),
        text(bind("holidays", "daysAway", { unit: " days away" }), { size: "sm", color: "accent", weight: 600 }),
      ],
      { gap: 0.25, align: "center", justify: "center" },
    ),
  },
  {
    id: "history.today",
    name: "On this day",
    description: "Things that happened on today's date in history.",
    icon: "calendar",
    category: "Time",
    size: { w: 400, h: 260 },
    needs: [{ key: "history", kind: "onThisDay", label: "On this day" }],
    params: [count("How many", 4, 8)],
    root: col(
      [
        text(bind("history", "date"), { size: "xs", color: "accent", caps: true, weight: 600 }),
        repeat(
          "history",
          "entries",
          row([text(item("year"), { size: "sm", weight: 700, color: "muted" }), text(item("text"), { size: "sm", grow: true, lines: 2 })], { gap: 0.5, align: "start" }),
          { gap: 0.6, limit: param("count"), empty: "Nothing for today." },
        ),
      ],
      { gap: 0.45 },
    ),
  },

  // ── News & web ───────────────────────────────────────────────────────────
  {
    id: "hn.list",
    name: "Hacker News",
    description: "Front-page stories with points and comment counts.",
    icon: "code",
    category: "News",
    size: { w: 420, h: 280 },
    needs: [{ key: "hn", kind: "hackerNews", label: "Hacker News" }],
    params: [count("How many stories", 6, 12)],
    root: col(
      [
        text("Hacker News", { size: "xs", color: "accent", caps: true, weight: 600 }),
        repeat(
          "hn",
          "stories",
          col(
            [
              text(item("title"), { size: "sm", lines: 2 }),
              row([text(item("points", { unit: " points" }), { size: "xs", color: "muted" }), text(item("comments", { unit: " comments" }), { size: "xs", color: "muted" })], { gap: 0.5 }),
            ],
            { gap: 0.1 },
          ),
          { gap: 0.6, limit: param("count"), empty: "Nothing loaded." },
        ),
      ],
      { gap: 0.45 },
    ),
  },
  {
    id: "github.repo",
    name: "GitHub project",
    description: "Stars, forks and open issues for a repository.",
    icon: "code",
    category: "News",
    size: { w: 340, h: 200 },
    needs: [{ key: "gh", kind: "github", label: "GitHub project" }],
    root: col(
      [
        row([image(bind("gh", "avatar"), { size: 1.4, radius: 0.7 }), text(bind("gh", "name"), { size: "md", weight: 700, grow: true, lines: 1 })], { gap: 0.4 }),
        row(
          [
            col([text(bind("gh", "stars"), { size: "md", weight: 700 }), text("stars", { size: "xs", color: "muted" })], { gap: 0.05, align: "center", grow: true }),
            col([text(bind("gh", "forks"), { size: "md", weight: 700 }), text("forks", { size: "xs", color: "muted" })], { gap: 0.05, align: "center", grow: true }),
            col([text(bind("gh", "openIssues"), { size: "md", weight: 700 }), text("issues", { size: "xs", color: "muted" })], { gap: 0.05, align: "center", grow: true }),
          ],
          { gap: 0.4 },
        ),
      ],
      { gap: 0.5, justify: "center" },
    ),
  },

  // ── Fun ──────────────────────────────────────────────────────────────────
  {
    id: "tv.tonight",
    name: "On TV tonight",
    description: "What's airing, with times and channels.",
    icon: "computer",
    category: "Fun",
    size: { w: 400, h: 270 },
    needs: [{ key: "tv", kind: "tv", label: "On TV tonight" }],
    params: [count("How many shows", 6, 12)],
    root: repeat(
      "tv",
      "shows",
      row([
        text(item("time"), { size: "sm", weight: 700, color: "accent" }),
        text(item("show"), { size: "sm", grow: true, lines: 1 }),
        spacer,
        text(item("network"), { size: "xs", color: "muted" }),
      ], { gap: 0.45 }),
      { gap: 0.55, limit: param("count"), empty: "Nothing listed." },
    ),
  },
  {
    id: "fun.joke",
    name: "Joke",
    description: "A setup and a punchline, refreshed through the day.",
    icon: "sparkles",
    category: "Fun",
    size: { w: 340, h: 200 },
    needs: [{ key: "fun", kind: "fun", label: "Something light" }],
    root: col(
      [
        text(bind("fun", "jokeSetup"), { size: "sm", lines: 3 }),
        text(bind("fun", "jokePunchline"), { size: "md", weight: 700, color: "accent", lines: 3 }),
      ],
      { gap: 0.4, justify: "center" },
    ),
  },
  {
    id: "fun.advice",
    name: "Advice",
    description: "One piece of unsolicited advice.",
    icon: "sparkles",
    category: "Fun",
    size: { w: 320, h: 170 },
    needs: [{ key: "fun", kind: "fun", label: "Something light" }],
    root: col([text(bind("fun", "advice"), { size: "md", lines: 4 })], { justify: "center", align: "center" }),
  },
  {
    id: "fun.dog",
    name: "Random dog",
    description: "A different dog every time it refreshes.",
    icon: "image",
    category: "Fun",
    size: { w: 300, h: 300 },
    needs: [{ key: "fun", kind: "fun", label: "Something light" }],
    root: col([image(bind("fun", "picture"), { grow: true, fit: "cover", radius: 0.4 })], { gap: 0 }),
  },
];
