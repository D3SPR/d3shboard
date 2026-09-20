import { DAY_NAMES, MONTH_NAMES, formatDate } from "../../lib/util";
import type { SourceKind } from "../types";

const inZone = (tz: string) => {
  const now = new Date();
  if (!tz) return now;
  try {
    return new Date(now.toLocaleString("en-US", { timeZone: tz }));
  } catch {
    return now; // Unknown zone name: local time.
  }
};

const greetingFor = (hour: number) =>
  hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

export const timeSource: SourceKind = {
  kind: "time",
  label: "Time & date",
  description: "The current time, day and date — in any time zone.",
  icon: "clock",
  refreshSec: 1,
  params: [
    {
      key: "timezone",
      label: "Time zone",
      kind: "text",
      hint: "Leave empty to use this device's own clock. Otherwise a name like Europe/Berlin or Asia/Tokyo.",
      placeholder: "Your device's time zone",
      default: "",
      options: [
        { value: "", label: "This device" },
        { value: "America/New_York", label: "New York" },
        { value: "America/Chicago", label: "Chicago" },
        { value: "America/Los_Angeles", label: "Los Angeles" },
        { value: "Europe/London", label: "London" },
        { value: "Europe/Berlin", label: "Berlin" },
        { value: "Asia/Tokyo", label: "Tokyo" },
        { value: "Australia/Sydney", label: "Sydney" },
        { value: "UTC", label: "UTC" },
      ],
    },
  ],
  fields: [
    { key: "now", label: "Time", type: "time", format: { pattern: "HH:mm" }, example: "2026-09-19T18:42:00" },
    { key: "seconds", label: "Seconds", type: "number", example: 7 },
    { key: "hour", label: "Hour", type: "number", example: 18 },
    { key: "ampm", label: "AM / PM", type: "text", example: "PM" },
    { key: "weekday", label: "Day name", type: "text", example: "Saturday" },
    { key: "weekdayShort", label: "Day name, short", type: "text", example: "Sat" },
    { key: "day", label: "Day of month", type: "number", example: 19 },
    { key: "month", label: "Month", type: "text", example: "September" },
    { key: "year", label: "Year", type: "number", example: 2026 },
    { key: "date", label: "Full date", type: "text", example: "Saturday, 19 September" },
    { key: "greeting", label: "Greeting", type: "text", hint: "Good morning / afternoon / evening.", example: "Good evening" },
  ],
  async load(params) {
    const now = inZone(params.timezone ?? "");
    return {
      now: formatDate(now, "YYYY-MM-DDTHH:mm:ss"),
      seconds: now.getSeconds(),
      hour: now.getHours(),
      ampm: now.getHours() < 12 ? "AM" : "PM",
      weekday: DAY_NAMES[now.getDay()],
      weekdayShort: DAY_NAMES[now.getDay()].slice(0, 3),
      day: now.getDate(),
      month: MONTH_NAMES[now.getMonth()],
      year: now.getFullYear(),
      date: formatDate(now, "dddd, DD MMMM"),
      greeting: greetingFor(now.getHours()),
    };
  },
};
