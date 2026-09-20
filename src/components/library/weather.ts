import { bar, bind, col, icon, item, param, repeat, row, spacer, text } from "../nodes";
import type { ComponentDef } from "../types";

const needs = [{ key: "weather", kind: "weather", label: "Weather" }];

const detailRow = (label: string, value: ReturnType<typeof bind>) =>
  row([text(label, { size: "sm", color: "muted" }), spacer, text(value, { size: "sm", weight: 600 })]);

export const WEATHER_COMPONENTS: ComponentDef[] = [
  {
    id: "weather.now",
    name: "Weather now",
    description: "Today's temperature, conditions and high/low.",
    icon: "sun",
    category: "Weather",
    size: { w: 340, h: 200 },
    needs,
    root: col(
      [
        row([icon(bind("weather", "icon"), { size: "2xl", color: "accent" }), text(bind("weather", "temp"), { size: "3xl", weight: 700 })], {
          gap: 0.5,
          justify: "center",
        }),
        text(bind("weather", "condition"), { size: "md" }),
        row(
          [
            text(bind("weather", "high", { prefix: "H " }), { size: "sm", color: "muted" }),
            text(bind("weather", "low", { prefix: "L " }), { size: "sm", color: "muted" }),
          ],
          { gap: 0.8, justify: "center" },
        ),
      ],
      { gap: 0.25, align: "center" },
    ),
  },
  {
    id: "weather.compact",
    name: "Weather, small",
    description: "One line: icon, temperature and place.",
    icon: "cloudSun",
    category: "Weather",
    size: { w: 300, h: 110 },
    needs,
    root: row(
      [
        icon(bind("weather", "icon"), { size: "xl", color: "accent" }),
        col(
          [
            text(bind("weather", "temp"), { size: "xl", weight: 700 }),
            text(bind("weather", "place"), { size: "xs", color: "muted" }),
          ],
          { gap: 0.1 },
        ),
      ],
      { gap: 0.6, justify: "center" },
    ),
  },
  {
    id: "weather.hours",
    name: "Next few hours",
    description: "A row of upcoming hours with icons and temperatures.",
    icon: "clock",
    category: "Weather",
    size: { w: 460, h: 160 },
    needs,
    params: [{ key: "count", label: "How many hours", kind: "number", min: 2, max: 12, default: 6 }],
    root: col(
      [
        text("Next hours", { size: "xs", color: "muted", caps: true, weight: 600 }),
        repeat(
          "weather",
          "hourly",
          col(
            [
              text(item("time"), { size: "xs", color: "muted" }),
              icon(item("icon"), { size: "lg", color: "accent" }),
              text(item("temp"), { size: "sm", weight: 600 }),
            ],
            { gap: 0.25, align: "center", grow: true },
          ),
          { dir: "row", gap: 0.5, limit: param("count") },
        ),
      ],
      { gap: 0.5 },
    ),
  },
  {
    id: "weather.week",
    name: "The week ahead",
    description: "A line for each day with its icon, high and low.",
    icon: "calendar",
    category: "Weather",
    size: { w: 360, h: 300 },
    needs,
    params: [{ key: "count", label: "How many days", kind: "number", min: 2, max: 7, default: 5 }],
    root: repeat(
      "weather",
      "daily",
      row([
        text(item("day"), { size: "sm", grow: true }),
        icon(item("icon"), { size: "md", color: "accent" }),
        spacer,
        text(item("high"), { size: "sm", weight: 600 }),
        text(item("low"), { size: "sm", color: "muted" }),
      ], { gap: 0.5 }),
      { gap: 0.55, limit: param("count") },
    ),
  },
  {
    id: "weather.details",
    name: "Weather details",
    description: "Feels like, humidity, wind and chance of rain.",
    icon: "droplet",
    category: "Weather",
    size: { w: 320, h: 220 },
    needs,
    root: col(
      [
        detailRow("Feels like", bind("weather", "feelsLike")),
        detailRow("Chance of rain", bind("weather", "rainChance")),
        detailRow("Humidity", bind("weather", "humidity")),
        detailRow("Wind", bind("weather", "wind")),
      ],
      { gap: 0.55, justify: "center" },
    ),
  },
  {
    id: "weather.sun",
    name: "Sunrise & sunset",
    description: "When the sun comes up and goes down today.",
    icon: "sun",
    category: "Weather",
    size: { w: 320, h: 140 },
    needs,
    root: row(
      [
        col([icon("sun", { size: "lg", color: "accent" }), text(bind("weather", "sunrise"), { size: "sm", weight: 600 })], {
          gap: 0.3,
          align: "center",
          grow: true,
        }),
        col([icon("moon", { size: "lg", color: "accent" }), text(bind("weather", "sunset"), { size: "sm", weight: 600 })], {
          gap: 0.3,
          align: "center",
          grow: true,
        }),
      ],
      { gap: 0.8, justify: "center" },
    ),
  },
  {
    id: "weather.rain",
    name: "Chance of rain",
    description: "How likely rain is, as a number and a bar.",
    icon: "rain",
    category: "Weather",
    size: { w: 300, h: 150 },
    needs,
    root: col(
      [
        row([icon("rain", { size: "lg", color: "accent" }), text(bind("weather", "rainChance"), { size: "2xl", weight: 700 })], {
          gap: 0.4,
          justify: "center",
        }),
        bar(bind("weather", "rainChance"), { max: "100" }),
        text("Chance of rain today", { size: "xs", color: "muted" }),
      ],
      { gap: 0.4, align: "center" },
    ),
  },
];
