import type { AnimationPart } from "../lib/types";

export type AnimatableProperty = {
  key: string;
  label: string;
  hint: string;
  input: "number" | "color";
  unit?: string;
  step?: number;
  defaults: { from: string; to: string };
  element?: AnimationPart;
  toKeyframe: (value: string) => Keyframe;
};

const n = (v: string) => Number(v) || 0;

export const PROPERTIES: AnimatableProperty[] = [
  {
    key: "opacity",
    label: "Visibility",
    hint: "0 is invisible, 1 is fully visible.",
    input: "number",
    step: 0.05,
    defaults: { from: "1", to: "0.3" },
    toKeyframe: (v) => ({ opacity: n(v) }),
  },
  {
    key: "scale",
    label: "Size",
    hint: "1 is normal size, 2 is double, 0.5 is half.",
    input: "number",
    step: 0.05,
    defaults: { from: "1", to: "1.2" },
    toKeyframe: (v) => ({ scale: String(n(v)) }),
  },
  {
    key: "rotate",
    label: "Rotation",
    hint: "In degrees. 360 is one full turn; negative turns the other way.",
    input: "number",
    unit: "°",
    defaults: { from: "0", to: "360" },
    toKeyframe: (v) => ({ rotate: `${n(v)}deg` }),
  },
  {
    key: "moveX",
    label: "Move sideways",
    hint: "In pixels. Positive moves right, negative moves left.",
    input: "number",
    unit: "px",
    defaults: { from: "0", to: "40" },
    toKeyframe: (v) => ({ translate: `${n(v)}px 0` }),
  },
  {
    key: "moveY",
    label: "Move up or down",
    hint: "In pixels. Negative moves up, positive moves down.",
    input: "number",
    unit: "px",
    defaults: { from: "0", to: "-30" },
    toKeyframe: (v) => ({ translate: `0 ${n(v)}px` }),
  },
  {
    key: "blur",
    label: "Blur",
    hint: "In pixels. 0 is sharp; higher is blurrier.",
    input: "number",
    unit: "px",
    defaults: { from: "0", to: "6" },
    toKeyframe: (v) => ({ filter: `blur(${n(v)}px)` }),
  },
  {
    key: "brightness",
    label: "Brightness",
    hint: "1 is normal, 2 is twice as bright, 0.5 is darker.",
    input: "number",
    step: 0.1,
    defaults: { from: "1", to: "1.6" },
    toKeyframe: (v) => ({ filter: `brightness(${n(v)})` }),
  },
  {
    key: "backgroundColor",
    label: "Card colour",
    hint: "Works best when the card has a plain colour rather than a gradient.",
    input: "color",
    element: "card",
    defaults: { from: "", to: "#ff5c8a" },
    toKeyframe: (v) => ({ backgroundColor: v }),
  },
  {
    key: "color",
    label: "Text colour",
    hint: "Changes the colour of the writing inside.",
    input: "color",
    element: "card",
    defaults: { from: "", to: "#ffd166" },
    toKeyframe: (v) => ({ color: v }),
  },
  {
    key: "borderColor",
    label: "Border colour",
    hint: "Changes the outline colour. The component needs a border thicker than 0.",
    input: "color",
    element: "card",
    defaults: { from: "", to: "#c7b8ff" },
    toKeyframe: (v) => ({ borderColor: v }),
  },
  {
    key: "borderRadius",
    label: "Corner roundness",
    hint: "In pixels. 0 is sharp corners; big numbers make it round.",
    input: "number",
    unit: "px",
    element: "card",
    defaults: { from: "", to: "80" },
    toKeyframe: (v) => ({ borderRadius: `${n(v)}px` }),
  },
  {
    key: "fontSize",
    label: "Text size",
    hint: "In pixels.",
    input: "number",
    unit: "px",
    element: "card",
    defaults: { from: "", to: "22" },
    toKeyframe: (v) => ({ fontSize: `${n(v)}px` }),
  },
  {
    key: "letterSpacing",
    label: "Letter spacing",
    hint: "In pixels. Spreads letters apart (or squeezes them with negatives).",
    input: "number",
    unit: "px",
    element: "card",
    defaults: { from: "", to: "4" },
    toKeyframe: (v) => ({ letterSpacing: `${n(v)}px` }),
  },
];

export const propertyByKey = (key: string) => PROPERTIES.find((p) => p.key === key);
