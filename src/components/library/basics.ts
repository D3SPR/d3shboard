import { bar, bind, col, divider, param, row, spacer, text } from "../nodes";
import type { ComponentDef } from "../types";

const needsJson = [{ key: "data", kind: "json", label: "Any data link" }];

export const BASIC_COMPONENTS: ComponentDef[] = [
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
    name: "Number with a goal",
    description: "A live value shown against a target, with a bar.",
    icon: "activity",
    category: "Numbers",
    size: { w: 340, h: 180 },
    needs: needsJson,
    params: [
      { key: "label", label: "Label", kind: "text", default: "Progress" },
      { key: "goal", label: "Goal", kind: "number", default: 100 },
    ],
    root: col(
      [
        row([text(param("label"), { size: "sm", color: "muted" }), spacer, text(bind("data", "number"), { size: "lg", weight: 700 })]),
        bar(bind("data", "number"), { max: param("goal") }),
        text(param("goal"), { size: "xs", color: "muted" }),
      ],
      { gap: 0.4, justify: "center" },
    ),
  },
  {
    id: "text.note",
    name: "Note",
    description: "Your own words, centred in a card.",
    icon: "text",
    category: "Text & shapes",
    size: { w: 300, h: 160 },
    needs: [],
    params: [{ key: "text", label: "What it says", kind: "text", default: "Write something here." }],
    root: col([text(param("text"), { size: "md" })], { justify: "center", align: "center" }),
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
