import { formatDate } from "../../lib/util.ts";
import type { FieldDef, SourceKind } from "../types";
import { decodeEntities, fetchJson, num } from "./shared.ts";

const DAY = 86_400_000;

export const countdownSource: SourceKind = {
  kind: "countdown",
  label: "Countdown & progress",
  description: "How long until a date you pick — plus how far through the year, month and week you are.",
  icon: "timer",
  group: "Time & personal",
  refreshSec: 30,
  params: [
    { key: "label", label: "What you're counting to", kind: "text", placeholder: "Holiday", default: "New Year" },
    { key: "date", label: "The date", kind: "text", hint: "Written as YYYY-MM-DD, optionally with a time: 2027-01-01 09:30.", placeholder: "2027-01-01", default: "2027-01-01" },
  ],
  fields: [
    { key: "label", label: "Label", type: "text", example: "New Year" },
    { key: "days", label: "Whole days left", type: "number", format: { decimals: 0 }, example: 103 },
    { key: "hours", label: "Hours left (after days)", type: "number", format: { decimals: 0 }, example: 7 },
    { key: "minutes", label: "Minutes left (after hours)", type: "number", format: { decimals: 0 }, example: 42 },
    { key: "totalHours", label: "Total hours left", type: "number", format: { decimals: 0 }, example: 2479 },
    { key: "weeks", label: "Weeks left", type: "number", format: { decimals: 1 }, example: 14.7 },
    { key: "target", label: "The date itself", type: "time", format: { pattern: "DD MMM YYYY" }, example: "2027-01-01" },
    { key: "isPast", label: "Already happened", type: "text", hint: '"yes" or "no".', example: "no" },
    { key: "daysSince", label: "Days since it happened", type: "number", format: { decimals: 0 }, example: 0 },
    { key: "yearPercent", label: "Year gone", type: "number", format: { unit: "%", decimals: 1 }, example: 72.1 },
    { key: "monthPercent", label: "Month gone", type: "number", format: { unit: "%", decimals: 0 }, example: 63 },
    { key: "weekPercent", label: "Week gone", type: "number", format: { unit: "%", decimals: 0 }, example: 41 },
    { key: "dayPercent", label: "Day gone", type: "number", format: { unit: "%", decimals: 0 }, example: 55 },
    { key: "dayOfYear", label: "Day of the year", type: "number", format: { decimals: 0 }, example: 263 },
    { key: "daysLeftInYear", label: "Days left this year", type: "number", format: { decimals: 0 }, example: 102 },
    { key: "weekNumber", label: "Week number", type: "number", format: { decimals: 0 }, example: 38 },
  ],
  async load(params) {
    const target = new Date((params.date || "2027-01-01").replace(" ", "T"));
    if (Number.isNaN(target.getTime())) throw new Error("That date didn't make sense. Use YYYY-MM-DD.");
    const now = new Date();
    const left = target.getTime() - now.getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekday = (now.getDay() + 6) % 7; // Monday first
    const startOfWeek = startOfDay - weekday * DAY;

    return {
      label: params.label || "",
      days: Math.max(0, Math.floor(left / DAY)),
      hours: Math.max(0, Math.floor((left % DAY) / 3600_000)),
      minutes: Math.max(0, Math.floor((left % 3600_000) / 60_000)),
      totalHours: Math.max(0, Math.floor(left / 3600_000)),
      weeks: Math.max(0, left / (7 * DAY)),
      target: target.toISOString(),
      isPast: left < 0 ? "yes" : "no",
      daysSince: left < 0 ? Math.floor(-left / DAY) : 0,
      yearPercent: ((now.getTime() - startOfYear) / (endOfYear - startOfYear)) * 100,
      monthPercent: ((now.getTime() - startOfMonth) / (endOfMonth - startOfMonth)) * 100,
      weekPercent: ((now.getTime() - startOfWeek) / (7 * DAY)) * 100,
      dayPercent: ((now.getTime() - startOfDay) / DAY) * 100,
      dayOfYear: Math.floor((now.getTime() - startOfYear) / DAY) + 1,
      daysLeftInYear: Math.ceil((endOfYear - now.getTime()) / DAY),
      weekNumber: Math.ceil((Math.floor((now.getTime() - startOfYear) / DAY) + new Date(startOfYear).getDay() + 1) / 7),
    };
  },
};

const holidayFields: FieldDef[] = [
  { key: "name", label: "Name", type: "text", example: "Thanksgiving Day" },
  { key: "date", label: "Date", type: "time", format: { pattern: "ddd DD MMM" }, example: "2026-11-26" },
  { key: "daysAway", label: "Days away", type: "number", format: { decimals: 0 }, example: 67 },
  { key: "weekday", label: "Day of the week", type: "text", example: "Thursday" },
];

export const holidaysSource: SourceKind = {
  kind: "holidays",
  label: "Public holidays",
  description: "The next day off, and the ones after it, for any country.",
  icon: "calendar",
  group: "Time & personal",
  refreshSec: 21_600,
  params: [
    {
      key: "country",
      label: "Country",
      kind: "text",
      hint: "Two-letter country code.",
      placeholder: "US",
      default: "US",
      options: [
        { value: "US", label: "United States" },
        { value: "GB", label: "United Kingdom" },
        { value: "CA", label: "Canada" },
        { value: "AU", label: "Australia" },
        { value: "DE", label: "Germany" },
        { value: "FR", label: "France" },
        { value: "JP", label: "Japan" },
        { value: "IE", label: "Ireland" },
      ],
    },
  ],
  fields: [
    { key: "nextName", label: "Next holiday", type: "text", example: "Thanksgiving Day" },
    { key: "nextDate", label: "Next holiday date", type: "time", format: { pattern: "ddd DD MMM" }, example: "2026-11-26" },
    { key: "daysAway", label: "Days until it", type: "number", format: { decimals: 0 }, example: 67 },
    { key: "nextWeekday", label: "Which day it falls on", type: "text", example: "Thursday" },
    { key: "holidays", label: "The ones coming up", type: "list", of: holidayFields, example: [] },
  ],
  async load(params) {
    const country = (params.country || "US").trim().toUpperCase();
    const data = await fetchJson(`https://date.nager.at/api/v3/NextPublicHolidays/${country}`);
    if (!Array.isArray(data) || !data.length) throw new Error(`No holidays found for "${country}".`);
    const holidays = data.slice(0, 10).map((h: any) => {
      const date = new Date(`${h.date}T12:00`);
      return {
        name: h.localName || h.name || "",
        date: h.date,
        daysAway: Math.ceil((date.getTime() - Date.now()) / DAY),
        weekday: formatDate(date, "dddd"),
      };
    });
    return {
      nextName: holidays[0].name,
      nextDate: holidays[0].date,
      daysAway: holidays[0].daysAway,
      nextWeekday: holidays[0].weekday,
      holidays,
    };
  },
};

const eventFields: FieldDef[] = [
  { key: "year", label: "Year", type: "text", example: "1783" },
  { key: "text", label: "What happened", type: "text", example: "The first hot-air balloon flight carrying passengers." },
];

export const onThisDaySource: SourceKind = {
  kind: "onThisDay",
  label: "On this day",
  description: "What happened on today's date in history, from Wikipedia.",
  icon: "calendar",
  group: "Time & personal",
  refreshSec: 21_600,
  params: [
    {
      key: "kind",
      label: "Show",
      kind: "select",
      default: "events",
      options: [
        { value: "events", label: "Events" },
        { value: "births", label: "Births" },
        { value: "deaths", label: "Deaths" },
      ],
    },
  ],
  fields: [
    { key: "entries", label: "Entries", type: "list", of: eventFields, example: [] },
    { key: "topYear", label: "First entry year", type: "text", example: "1783" },
    { key: "topText", label: "First entry", type: "text", example: "The first hot-air balloon flight carrying passengers." },
    { key: "date", label: "Today's date", type: "text", example: "20 September" },
    { key: "count", label: "How many entries", type: "number", format: { decimals: 0 }, example: 8 },
  ],
  async load(params) {
    const kind = params.kind || "events";
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const data = await fetchJson(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/${kind}/${mm}/${dd}`);
    const list = (data[kind] ?? []).slice(0, 12).map((e: any) => ({
      year: String(e.year ?? ""),
      text: decodeEntities(e.text ?? ""),
    }));
    if (!list.length) throw new Error("Wikipedia had nothing for today.");
    return {
      entries: list,
      topYear: list[0].year,
      topText: list[0].text,
      date: formatDate(now, "DD MMMM"),
      count: num(list.length),
    };
  },
};
