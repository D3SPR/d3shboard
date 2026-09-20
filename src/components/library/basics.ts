import { bar, bind, button, checklist, col, divider, field, param, row, spacer, stepper, text, when } from "../nodes.ts";
import type { ComponentDef } from "../types";

const needsJson = [{ key: "data", kind: "json", label: "Any data link" }];

export const BASIC_COMPONENTS: ComponentDef[] = [
  {
    id: "blank.value",
    name: "Pick your own value",
    description: "A label and one value, ready to point at anything in your data.",
    icon: "pointer",
    category: "Text & shapes",
    size: { w: 300, h: 160 },
    needs: [],
    params: [{ key: "label", label: "Label", kind: "text", default: "Pick a value" }],
    root: {
      kind: "canvas",
      items: [
        { id: "label", x: 0.06, y: 0.12, w: 0.88, h: 0.2, align: "center", node: text(param("label"), { scale: 0.8, color: "accent", caps: true, weight: 600 }) },
        { id: "value", x: 0.06, y: 0.38, w: 0.88, h: 0.42, align: "center", node: text("—", { scale: 2.6, weight: 700 }) },
      ],
    },
  },
  {
    id: "blank.row",
    name: "Build your own",
    description: "An empty card. Drop in exactly the values you want and drag them where you like.",
    icon: "layers",
    category: "Text & shapes",
    size: { w: 340, h: 200 },
    needs: [],
    root: { kind: "canvas", items: [] },
  },
  {
    id: "number.big",
    name: "Big number",
    description: "One live value from a data link, with a label.",
    icon: "gauge",
    category: "Numbers",
    size: { w: 320, h: 180 },
    needs: needsJson,
    params: [
      { key: "label", label: "Label", kind: "text", default: "Live value" },
      { key: "prefix", label: "Before the value", kind: "text", hint: "For example a currency sign.", default: "" },
      { key: "suffix", label: "After the value", kind: "text", default: "" },
    ],
    root: col(
      [
        text(param("label"), { size: "xs", color: "accent", caps: true, weight: 600 }),
        row([text(param("prefix"), { size: "xl", weight: 700 }), text(bind("data", "value"), { size: "2xl", weight: 700 }), text(param("suffix"), { size: "md", color: "muted" })], {
          gap: 0.1,
          justify: "center",
        }),
      ],
      { gap: 0.25, align: "center" },
    ),
  },
  {
    id: "number.goal",
    name: "Goal tracker",
    description: "A value against a target, with a bar. Tap − and + to count it yourself, or connect live data.",
    icon: "activity",
    category: "Numbers",
    size: { w: 340, h: 190 },
    needs: [{ key: "data", kind: "json", label: "Live value (optional)", optional: true }],
    params: [
      { key: "label", label: "Label", kind: "text", default: "Progress" },
      {
        key: "mode",
        label: "Where the number comes from",
        kind: "select",
        default: "manual",
        options: [
          { value: "manual", label: "I set it" },
          { value: "live", label: "From data" },
        ],
      },
      { key: "value", label: "Current value", kind: "number", default: 3 },
      { key: "step", label: "Each tap adds", kind: "number", default: 1 },
      { key: "goal", label: "Goal", kind: "number", default: 10 },
    ],
    root: col(
      [
        row([text(param("label"), { size: "sm", color: "muted" }), spacer, text(param("goal", ), { size: "sm", color: "muted" })]),
        when(param("mode"), stepper("value", { stepParam: "step", min: 0, size: "xl" }), {
          is: "manual",
          else: text(bind("data", "number"), { size: "xl", weight: 700 }),
        }),
        when(param("mode"), bar(param("value"), { max: param("goal") }), {
          is: "manual",
          else: bar(bind("data", "number"), { max: param("goal") }),
        }),
      ],
      { gap: 0.45, justify: "center" },
    ),
  },
  {
    id: "list.todo",
    name: "To-do list",
    description: "Tick things off and add new ones, right on the dashboard.",
    icon: "check",
    category: "Text & shapes",
    size: { w: 320, h: 260 },
    needs: [],
    params: [
      { key: "title", label: "Title", kind: "text", default: "Today" },
      { key: "items", label: "Items", kind: "text", hint: "One per line. Put x in front of a line to start it ticked.", default: "Buy milk\nWalk the dog\nx Water the plants" },
    ],
    root: col(
      [
        text(param("title"), { size: "xs", color: "accent", caps: true, weight: 600 }),
        checklist("items", { limit: 10 }),
      ],
      { gap: 0.5 },
    ),
  },
  {
    id: "text.note",
    name: "Note",
    description: "Your own words — and you can retype them on the finished dashboard, no editing needed.",
    icon: "text",
    category: "Text & shapes",
    size: { w: 300, h: 160 },
    needs: [],
    params: [{ key: "text", label: "What it says", kind: "text", default: "Write something here." }],
    root: col([field("text", { size: "md", multiline: true, grow: true, placeholder: "Write something…" })], { gap: 0, grow: true }),
  },
  {
    id: "count.tally",
    name: "Tally counter",
    description: "A number you tap up and down. Cups of coffee, days without, anything.",
    icon: "plus",
    category: "Numbers",
    size: { w: 300, h: 180 },
    needs: [],
    params: [
      { key: "label", label: "Label", kind: "text", default: "Count" },
      { key: "count", label: "Current count", kind: "number", default: 0 },
    ],
    root: col(
      [
        text(param("label"), { size: "xs", color: "accent", caps: true, weight: 600 }),
        stepper("count", { size: "2xl", min: 0 }),
        button("Reset", "set", { param: "count", to: "0", icon: "undo" }),
      ],
      { gap: 0.35, align: "center", justify: "center" },
    ),
  },
  {
    id: "text.heading",
    name: "Heading",
    description: "A short title in the highlight colour.",
    icon: "text",
    category: "Text & shapes",
    size: { w: 320, h: 90 },
    needs: [],
    params: [{ key: "text", label: "What it says", kind: "text", default: "My dashboard" }],
    root: col([text(param("text"), { size: "lg", weight: 700, color: "accent", caps: true })], { justify: "center" }),
  },
  {
    id: "text.label",
    name: "Label with a line",
    description: "A small caption with a rule under it — good for splitting a page up.",
    icon: "text",
    category: "Text & shapes",
    size: { w: 360, h: 80 },
    needs: [],
    params: [{ key: "text", label: "What it says", kind: "text", default: "Section" }],
    root: col([text(param("text"), { size: "xs", color: "muted", caps: true, weight: 600 }), divider], { gap: 0.4, justify: "center" }),
  },
];
