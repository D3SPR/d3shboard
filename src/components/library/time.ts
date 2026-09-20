import { bind, col, param, row, spacer, text, when } from "../nodes.ts";
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
];
