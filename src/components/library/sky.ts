import { bar, bind, col, icon, image, item, repeat, row, spacer, text, when } from "../nodes.ts";
import type { ComponentDef } from "../types";

export const SKY_COMPONENTS: ComponentDef[] = [
  {
    id: "air.now",
    name: "Air quality",
    description: "The air quality index right now, in words as well as numbers.",
    icon: "droplet",
    category: "Weather",
    size: { w: 320, h: 200 },
    needs: [{ key: "air", kind: "airQuality", label: "Air quality & pollen" }],
    root: col(
      [
        text("Air quality", { size: "xs", color: "muted", caps: true, weight: 600 }),
        text(bind("air", "aqi"), { size: "3xl", weight: 700 }),
        text(bind("air", "category"), { size: "md", color: "accent", weight: 600 }),
        bar(bind("air", "aqi"), { max: "200", color: "accent" }),
      ],
      { gap: 0.3, align: "center", justify: "center" },
    ),
  },
  {
    id: "air.detail",
    name: "What's in the air",
    description: "Particles, ozone and pollen, one line each.",
    icon: "droplet",
    category: "Weather",
    size: { w: 320, h: 220 },
    needs: [{ key: "air", kind: "airQuality", label: "Air quality & pollen" }],
    root: col(
      [
        row([text("Fine particles", { size: "sm", color: "muted" }), spacer, text(bind("air", "pm25"), { size: "sm", weight: 600 })]),
        row([text("Coarse particles", { size: "sm", color: "muted" }), spacer, text(bind("air", "pm10"), { size: "sm", weight: 600 })]),
        row([text("Ozone", { size: "sm", color: "muted" }), spacer, text(bind("air", "ozone"), { size: "sm", weight: 600 })]),
        row([text("Grass pollen", { size: "sm", color: "muted" }), spacer, text(bind("air", "grassPollen"), { size: "sm", weight: 600 })]),
        row([text("Ragweed pollen", { size: "sm", color: "muted" }), spacer, text(bind("air", "ragweedPollen"), { size: "sm", weight: 600 })]),
      ],
      { gap: 0.45, justify: "center" },
    ),
  },
  {
    id: "sun.day",
    name: "Sunrise & sunset",
    description: "When the sun comes up and goes down, and how long the day is.",
    icon: "sun",
    category: "Weather",
    size: { w: 340, h: 180 },
    needs: [{ key: "sun", kind: "sunMoon", label: "Sun & moon" }],
    root: col(
      [
        row(
          [
            col([icon("sun", { size: "lg", color: "accent" }), text(bind("sun", "sunrise"), { size: "sm", weight: 600 })], { gap: 0.25, align: "center", grow: true }),
            col([icon("moon", { size: "lg", color: "accent" }), text(bind("sun", "sunset"), { size: "sm", weight: 600 })], { gap: 0.25, align: "center", grow: true }),
          ],
          { gap: 0.6, justify: "center" },
        ),
        text(bind("sun", "dayLength", { prefix: "Daylight: " }), { size: "xs", color: "muted" }),
      ],
      { gap: 0.4, align: "center", justify: "center" },
    ),
  },
  {
    id: "moon.phase",
    name: "Moon phase",
    description: "Tonight's moon, how lit it is, and when the next full moon lands.",
    icon: "moon",
    category: "Weather",
    size: { w: 280, h: 200 },
    needs: [{ key: "sun", kind: "sunMoon", label: "Sun & moon" }],
    root: col(
      [
        text(bind("sun", "moonEmoji"), { size: "3xl" }),
        text(bind("sun", "moonPhase"), { size: "sm", weight: 600 }),
        text(bind("sun", "moonIllumination", { prefix: "Lit " }), { size: "xs", color: "muted" }),
        text(bind("sun", "daysToFullMoon", { prefix: "Full moon in ", unit: " days" }), { size: "xs", color: "accent" }),
      ],
      { gap: 0.2, align: "center", justify: "center" },
    ),
  },
  {
    id: "radar.map",
    name: "Rain radar",
    description: "A live radar picture of the rain near you.",
    icon: "rain",
    category: "Weather",
    size: { w: 360, h: 320 },
    needs: [{ key: "radar", kind: "radar", label: "Rain radar" }],
    root: col(
      [
        image(bind("radar", "image"), { grow: true, fit: "cover", radius: 0.4 }),
        text(bind("radar", "time"), { size: "xs", color: "muted" }),
      ],
      { gap: 0.3, align: "center" },
    ),
  },
  {
    id: "alerts.now",
    name: "Weather warnings",
    description: "Official warnings for your area, or a quiet all-clear.",
    icon: "zap",
    category: "Weather",
    size: { w: 380, h: 200 },
    needs: [{ key: "alerts", kind: "weatherAlerts", label: "Weather warnings (US)" }],
    root: when(
      bind("alerts", "anyActive"),
      col(
        [
          row([icon("zap", { size: "md", color: "negative" }), text(bind("alerts", "event"), { size: "md", weight: 700, color: "negative", grow: true, lines: 2 })], { gap: 0.4 }),
          text(bind("alerts", "headline"), { size: "sm", lines: 3 }),
        ],
        { gap: 0.35, justify: "center" },
      ),
      {
        is: "yes",
        else: col([icon("check", { size: "lg", color: "positive" }), text("No warnings", { size: "sm", color: "muted" })], {
          gap: 0.3,
          align: "center",
          justify: "center",
        }),
      },
    ),
  },
  {
    id: "tides.next",
    name: "Next tide",
    description: "High or low, when it lands and how high it gets.",
    icon: "droplet",
    category: "Weather",
    size: { w: 300, h: 190 },
    needs: [{ key: "tides", kind: "tides", label: "Tides" }],
    root: col(
      [
        text(bind("tides", "nextType"), { size: "sm", color: "accent", caps: true, weight: 700 }),
        text(bind("tides", "nextTime"), { size: "2xl", weight: 700 }),
        text(bind("tides", "nextHeight"), { size: "sm", color: "muted" }),
        text(bind("tides", "nextAway"), { size: "xs", color: "muted" }),
      ],
      { gap: 0.2, align: "center", justify: "center" },
    ),
  },
  {
    id: "tides.today",
    name: "Tides today",
    description: "Every high and low coming up.",
    icon: "droplet",
    category: "Weather",
    size: { w: 320, h: 240 },
    needs: [{ key: "tides", kind: "tides", label: "Tides" }],
    root: repeat(
      "tides",
      "tides",
      row([
        text(item("type"), { size: "sm", weight: 600, grow: true }),
        text(item("time"), { size: "sm" }),
        spacer,
        text(item("height"), { size: "sm", color: "muted" }),
      ], { gap: 0.4 }),
      { gap: 0.5, limit: "6", empty: "No tide predictions." },
    ),
  },
  {
    id: "waves.now",
    name: "Surf report",
    description: "Wave height, period and sea temperature.",
    icon: "droplet",
    category: "Weather",
    size: { w: 320, h: 200 },
    needs: [{ key: "sea", kind: "marine", label: "Waves & sea" }],
    root: col(
      [
        text(bind("sea", "waveHeight"), { size: "2xl", weight: 700 }),
        text("wave height", { size: "xs", color: "muted", caps: true }),
        row([text(bind("sea", "wavePeriod", { prefix: "Period " }), { size: "sm", color: "muted" }), text(bind("sea", "seaTemperature", { prefix: "Sea " }), { size: "sm", color: "muted" })], { gap: 0.6, justify: "center" }),
      ],
      { gap: 0.2, align: "center", justify: "center" },
    ),
  },
];
