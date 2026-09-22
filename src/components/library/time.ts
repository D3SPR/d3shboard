import { bind, col, param, row, spacer, text, timer, when } from "../nodes.ts";
import type { ComponentDef } from "../types";

const needsTime = [{ key: "time", kind: "time", label: "Time & date" }];

const hourFormat = (big: boolean) =>
  when(param("clock"), text(bind("time", "now", { pattern: "h:mm A" }), { size: big ? "3xl" : "xl", weight: 700 }), {
    is: "12",
    else: text(bind("time", "now", { pattern: "HH:mm" }), { size: big ? "3xl" : "xl", weight: 700 }),
  });

const clockParam = {
  key: "clock",
  label: "Clock style",
  kind: "select" as const,
  default: "24",
  options: [
    { value: "24", label: "20:45" },
    { value: "12", label: "8:45 PM" },
  ],
};

export const TIME_COMPONENTS: ComponentDef[] = [
  {
    id: "time.big",
    name: "Big clock",
    description: "The time, large, with today's date underneath.",
    icon: "clock",
    category: "Time",
    size: { w: 340, h: 170 },
    needs: needsTime,
    params: [clockParam],
    root: col([hourFormat(true), text(bind("time", "date"), { size: "sm", color: "muted" })], { gap: 0.25, align: "center" }),
  },
  {
    id: "time.simple",
    name: "Time only",
    description: "Just the clock, nothing else.",
    icon: "clock",
    category: "Time",
    size: { w: 260, h: 130 },
    needs: needsTime,
    params: [clockParam],
    root: col([hourFormat(true)], { align: "center" }),
  },
  {
    id: "time.greeting",
    name: "Greeting",
    description: '"Good evening" with the time beside it.',
    icon: "sun",
    category: "Time",
    size: { w: 360, h: 140 },
    needs: needsTime,
    params: [clockParam],
    root: col(
      [
        text(bind("time", "greeting"), { size: "xl", weight: 600 }),
        row([text(bind("time", "weekday"), { size: "sm", color: "muted" }), spacer, hourFormat(false)], { gap: 0.6 }),
      ],
      { gap: 0.3 },
    ),
  },
  {
    id: "time.date",
    name: "Today's date",
    description: "The day of the month, big, with the weekday and month.",
    icon: "calendar",
    category: "Time",
    size: { w: 240, h: 200 },
    needs: needsTime,
    root: col(
      [
        text(bind("time", "weekday"), { size: "sm", color: "accent", caps: true, weight: 600 }),
        text(bind("time", "day"), { size: "3xl", weight: 700 }),
        text(bind("time", "month"), { size: "sm", color: "muted" }),
      ],
      { gap: 0.15, align: "center" },
    ),
  },
  {
    id: "time.world",
    name: "World clock",
    description: "The time somewhere else, with a label you choose.",
    icon: "globe",
    category: "Time",
    size: { w: 260, h: 150 },
    needs: [{ key: "time", kind: "time", label: "Time & date (set its time zone)" }],
    params: [{ key: "label", label: "Label", kind: "text", default: "Tokyo" }],
    root: col(
      [
        text(param("label"), { size: "sm", color: "accent", caps: true, weight: 600 }),
        text(bind("time", "now", { pattern: "HH:mm" }), { size: "2xl", weight: 700 }),
        text(bind("time", "weekdayShort"), { size: "xs", color: "muted" }),
      ],
      { gap: 0.15, align: "center" },
    ),
  },
  {
    id: "time.stopwatch",
    name: "Stopwatch",
    description: "Start, pause and lap. Keeps counting even if you close the page.",
    icon: "timer",
    category: "Time",
    size: { w: 300, h: 220 },
    needs: [],
    params: [{ key: "label", label: "Label", kind: "text", default: "" }],
    root: col([timer("stopwatch")], { justify: "center", align: "center" }),
  },
  {
    id: "time.timer",
    name: "Timer",
    description: "Counts down and chimes at zero. Add a minute while it runs.",
    icon: "timer",
    category: "Time",
    size: { w: 300, h: 210 },
    needs: [],
    params: [
      { key: "label", label: "What it's for", kind: "text", default: "" },
      { key: "minutes", label: "Minutes", kind: "number", default: 5 },
      { key: "seconds", label: "Seconds", kind: "number", default: 0 },
    ],
    root: col([timer("countdown")], { justify: "center", align: "center" }),
  },
  {
    id: "time.pomodoro",
    name: "Focus timer",
    description: "Pomodoro: focus, short break, repeat, with a longer break every few rounds.",
    icon: "timer",
    category: "Time",
    size: { w: 320, h: 240 },
    needs: [],
    params: [
      { key: "work", label: "Focus minutes", kind: "number", default: 25 },
      { key: "short", label: "Short break minutes", kind: "number", default: 5 },
      { key: "long", label: "Long break minutes", kind: "number", default: 15 },
      { key: "every", label: "Long break every", kind: "number", hint: "How many focus rounds before a long break.", default: 4 },
    ],
    root: col([timer("pomodoro")], { justify: "center", align: "center" }),
  },
  {
    id: "time.alarm",
    name: "Alarm",
    description: "Rings at the same time every day while the dashboard is open.",
    icon: "clock",
    category: "Time",
    size: { w: 300, h: 200 },
    needs: [],
    params: [
      { key: "label", label: "Label", kind: "text", default: "Wake up" },
      { key: "at", label: "Time", kind: "text", hint: "24-hour, like 07:30 or 18:00.", default: "07:00" },
    ],
    root: col([timer("alarm")], { justify: "center", align: "center" }),
  },
];
