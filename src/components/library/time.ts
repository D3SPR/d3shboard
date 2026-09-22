import { bind, clocks, col, param, row, spacer, text, timer, when } from "../nodes.ts";
import { writeAlarms, writePlaces, writeSteps } from "../timing.ts";
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
    description: "The time in one place or many, side by side, with how far ahead each is.",
    icon: "globe",
    category: "Time",
    size: { w: 420, h: 180 },
    needs: [],
    params: [
      {
        key: "places",
        label: "Places",
        kind: "places",
        hint: 'A JSON list like [{"label":"Tokyo","tz":"Asia/Tokyo"}]. An empty tz is this device\'s own time.',
        default: writePlaces([
          { label: "New York", tz: "America/New_York" },
          { label: "London", tz: "Europe/London" },
          { label: "Tokyo", tz: "Asia/Tokyo" },
        ]),
      },
      clockParam,
      { key: "details", label: "Show the day and hours ahead", kind: "toggle", default: "yes" },
    ],
    root: col([clocks()], { justify: "center", align: "center" }),
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
    description: "A countdown, pomodoro or workout intervals: set the steps and rounds, and choose whether each step starts by itself.",
    icon: "timer",
    category: "Time",
    size: { w: 320, h: 240 },
    needs: [],
    params: [
      {
        key: "steps",
        label: "Steps",
        kind: "steps",
        hint: 'A JSON list like [{"name":"Focus","sec":1500},{"name":"Break","sec":300}], run in order.',
        default: writeSteps([{ name: "Timer", sec: 300 }]),
      },
      { key: "rounds", label: "Rounds", kind: "number", hint: "How many times to go through the steps. 0 keeps going until you stop it.", default: 1 },
      {
        key: "auto",
        label: "When a step ends",
        kind: "select",
        default: "auto",
        options: [
          { value: "auto", label: "Start the next" },
          { value: "wait", label: "Wait for me" },
        ],
        showIf: { param: "rounds", not: 1 },
      },
      {
        key: "longBreak",
        label: "Long break (minutes)",
        kind: "number",
        hint: "Takes the place of the last step every few rounds, like a pomodoro's long break. 0 for none.",
        default: 0,
        showIf: { param: "rounds", not: 1 },
      },
      { key: "longEvery", label: "Long break every", kind: "number", hint: "How many rounds between long breaks.", default: 4, showIf: { param: "longBreak", not: 0 } },
      { key: "sound", label: "Chime", kind: "toggle", default: "yes" },
    ],
    root: col([timer("intervals")], { justify: "center", align: "center" }),
  },
  {
    id: "time.alarm",
    name: "Alarm",
    description: "One alarm or several, on the days you choose, with snooze. Rings while the dashboard is open.",
    icon: "clock",
    category: "Time",
    size: { w: 320, h: 220 },
    needs: [],
    params: [
      {
        key: "alarms",
        label: "Alarms",
        kind: "alarms",
        hint: 'A JSON list like [{"id":"a1","time":"07:00","label":"Wake up","days":[1,2,3,4,5],"on":true}]. Days run 0 (Sunday) to 6; none means every day.',
        default: writeAlarms([{ id: "a1", time: "07:00", label: "Wake up", days: [1, 2, 3, 4, 5], on: true }]),
      },
      { key: "snooze", label: "Snooze for", kind: "number", hint: "Minutes.", default: 9 },
      clockParam,
    ],
    root: col([timer("alarm")], { justify: "center", align: "center" }),
  },
];
