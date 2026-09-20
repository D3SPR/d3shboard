import { DAY_NAMES } from "../../lib/util.ts";
import type { IconName } from "../../ui/icons";
import type { SourceKind } from "../types";
import { fetchJson, num } from "./shared.ts";

/** WMO weather codes → a word and one of the app's weather icons. */
const CODES: Record<number, { text: string; icon: IconName }> = {
  0: { text: "Clear", icon: "sun" },
  1: { text: "Mostly clear", icon: "cloudSun" },
  2: { text: "Partly cloudy", icon: "cloudSun" },
  3: { text: "Overcast", icon: "cloud" },
  45: { text: "Fog", icon: "fog" },
  48: { text: "Freezing fog", icon: "fog" },
  51: { text: "Light drizzle", icon: "rain" },
  53: { text: "Drizzle", icon: "rain" },
  55: { text: "Heavy drizzle", icon: "rain" },
  56: { text: "Freezing drizzle", icon: "rain" },
  57: { text: "Freezing drizzle", icon: "rain" },
  61: { text: "Light rain", icon: "rain" },
  63: { text: "Rain", icon: "rain" },
  65: { text: "Heavy rain", icon: "rain" },
  66: { text: "Freezing rain", icon: "rain" },
  67: { text: "Freezing rain", icon: "rain" },
  71: { text: "Light snow", icon: "snow" },
  73: { text: "Snow", icon: "snow" },
  75: { text: "Heavy snow", icon: "snow" },
  77: { text: "Snow grains", icon: "snow" },
  80: { text: "Showers", icon: "rain" },
  81: { text: "Showers", icon: "rain" },
  82: { text: "Heavy showers", icon: "rain" },
  85: { text: "Snow showers", icon: "snow" },
  86: { text: "Snow showers", icon: "snow" },
  95: { text: "Thunderstorm", icon: "storm" },
  96: { text: "Thunderstorm", icon: "storm" },
  99: { text: "Thunderstorm", icon: "storm" },
};

const describe = (code: number, isDay = true) => {
  const found = CODES[code] ?? { text: "—", icon: "cloud" as IconName };
  return found.icon === "sun" && !isDay ? { text: found.text, icon: "moon" as IconName } : found;
};

const hourFields = [
  { key: "time", label: "Time", type: "time" as const, format: { pattern: "h A" }, example: "2026-09-19T19:00" },
  { key: "temp", label: "Temperature", type: "number" as const, format: { unit: "°", decimals: 0 }, example: 68 },
  { key: "condition", label: "Condition", type: "text" as const, example: "Partly cloudy" },
  { key: "icon", label: "Icon", type: "icon" as const, example: "cloudSun" },
  { key: "rainChance", label: "Chance of rain", type: "number" as const, format: { unit: "%", decimals: 0 }, example: 20 },
];

const dayFields = [
  { key: "day", label: "Day", type: "text" as const, example: "Sun" },
  { key: "date", label: "Date", type: "time" as const, format: { pattern: "DD MMM" }, example: "2026-09-20" },
  { key: "high", label: "High", type: "number" as const, format: { unit: "°", decimals: 0 }, example: 74 },
  { key: "low", label: "Low", type: "number" as const, format: { unit: "°", decimals: 0 }, example: 58 },
  { key: "condition", label: "Condition", type: "text" as const, example: "Showers" },
  { key: "icon", label: "Icon", type: "icon" as const, example: "rain" },
  { key: "rainChance", label: "Chance of rain", type: "number" as const, format: { unit: "%", decimals: 0 }, example: 60 },
];

// Stand-ins so library previews look real before a place is chosen.
const exampleHours = [0, 1, 2, 3, 4, 5].map((i) => ({
  time: `2026-09-19T${String(19 + i).padStart(2, "0")}:00`,
  temp: 68 - i,
  condition: "Partly cloudy",
  icon: i > 2 ? "moon" : "cloudSun",
  rainChance: 10 + i * 5,
}));

const exampleDays = ["Today", "Sun", "Mon", "Tue", "Wed"].map((day, i) => ({
  day,
  date: `2026-09-${20 + i}`,
  high: 74 - i * 2,
  low: 58 - i,
  condition: ["Clear", "Showers", "Overcast", "Clear", "Thunderstorm"][i],
  icon: ["sun", "rain", "cloud", "sun", "storm"][i],
  rainChance: [10, 60, 20, 5, 70][i],
}));

export const weatherSource: SourceKind = {
  kind: "weather",
  label: "Weather",
  description: "Now, by the hour and for the week ahead, anywhere in the world.",
  icon: "sun",
  refreshSec: 900,
  params: [
    { key: "place", label: "Place", kind: "place", hint: "Search for a town or city. Everything else fills in for you.", default: "" },
    {
      key: "units",
      label: "Units",
      kind: "select",
      default: "fahrenheit",
      options: [
        { value: "fahrenheit", label: "°F, mph" },
        { value: "celsius", label: "°C, km/h" },
      ],
    },
  ],
  fields: [
    { key: "place", label: "Place name", type: "text", example: "Milwaukee" },
    { key: "temp", label: "Temperature", type: "number", format: { unit: "°", decimals: 0 }, example: 68 },
    { key: "feelsLike", label: "Feels like", type: "number", format: { unit: "°", decimals: 0 }, example: 65 },
    { key: "condition", label: "Condition", type: "text", example: "Partly cloudy" },
    { key: "icon", label: "Weather icon", type: "icon", example: "cloudSun" },
    { key: "high", label: "Today's high", type: "number", format: { unit: "°", decimals: 0 }, example: 74 },
    { key: "low", label: "Today's low", type: "number", format: { unit: "°", decimals: 0 }, example: 58 },
    { key: "rainChance", label: "Chance of rain", type: "number", format: { unit: "%", decimals: 0 }, example: 20 },
    { key: "humidity", label: "Humidity", type: "number", format: { unit: "%", decimals: 0 }, example: 61 },
    { key: "wind", label: "Wind speed", type: "number", format: { decimals: 0 }, example: 9 },
    { key: "windUnit", label: "Wind unit", type: "text", example: "mph" },
    { key: "sunrise", label: "Sunrise", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-19T06:41" },
    { key: "sunset", label: "Sunset", type: "time", format: { pattern: "h:mm A" }, example: "2026-09-19T19:02" },
    { key: "isDay", label: "Daytime", type: "text", example: "yes" },
    { key: "hourly", label: "Next hours", type: "list", of: hourFields, example: exampleHours },
    { key: "daily", label: "Next days", type: "list", of: dayFields, example: exampleDays },
  ],
  async load(params) {
    const lat = num(params.lat, 43.0389);
    const lon = num(params.lon, -87.9065);
    const units = params.units === "celsius" ? "celsius" : "fahrenheit";
    const windUnit = units === "celsius" ? "kmh" : "mph";
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,precipitation_probability` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
      `&temperature_unit=${units}&wind_speed_unit=${windUnit}&timezone=auto&forecast_days=7`;
    const data = await fetchJson(url);

    const current = data.current ?? {};
    const isDay = current.is_day !== 0;
    const now = describe(num(current.weather_code), isDay);
    const daily = data.daily ?? {};
    const hourly = data.hourly ?? {};

    const startHour = Math.max(
      0,
      (hourly.time ?? []).findIndex((t: string) => new Date(t).getTime() >= Date.now() - 30 * 60_000),
    );
    const hours = (hourly.time ?? []).slice(startHour, startHour + 12).map((time: string, i: number) => {
      const index = startHour + i;
      const look = describe(num(hourly.weather_code?.[index]), new Date(time).getHours() > 6 && new Date(time).getHours() < 20);
      return {
        time,
        temp: num(hourly.temperature_2m?.[index]),
        condition: look.text,
        icon: look.icon,
        rainChance: num(hourly.precipitation_probability?.[index]),
      };
    });

    const days = (daily.time ?? []).map((date: string, i: number) => {
      const look = describe(num(daily.weather_code?.[i]));
      return {
        day: i === 0 ? "Today" : DAY_NAMES[new Date(`${date}T12:00`).getDay()].slice(0, 3),
        date,
        high: num(daily.temperature_2m_max?.[i]),
        low: num(daily.temperature_2m_min?.[i]),
        condition: look.text,
        icon: look.icon,
        rainChance: num(daily.precipitation_probability_max?.[i]),
      };
    });

    return {
      place: params.place || "",
      temp: num(current.temperature_2m),
      feelsLike: num(current.apparent_temperature),
      condition: now.text,
      icon: now.icon,
      high: days[0]?.high ?? 0,
      low: days[0]?.low ?? 0,
      rainChance: num(current.precipitation_probability ?? daily.precipitation_probability_max?.[0]),
      humidity: num(current.relative_humidity_2m),
      wind: num(current.wind_speed_10m),
      windUnit: units === "celsius" ? "km/h" : "mph",
      sunrise: daily.sunrise?.[0] ?? "",
      sunset: daily.sunset?.[0] ?? "",
      isDay: isDay ? "yes" : "no",
      hourly: hours,
      daily: days,
    };
  },
};

/** Used by the place picker in the Data menu. */
export async function searchPlaces(query: string) {
  const data = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`,
  );
  return ((data.results ?? []) as any[]).map((r) => ({
    label: [r.name, r.admin1, r.country_code].filter(Boolean).join(", "),
    name: r.name as string,
    lat: num(r.latitude),
    lon: num(r.longitude),
  }));
}
