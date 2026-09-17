import type { Timing } from "../lib/types";

export type PresetContext = { accent: string };

export type Preset = {
  key: string;
  label: string;
  description: string;
  group: "Appear" | "Get attention" | "Disappear" | "Keep moving";
  usesCard?: boolean;
  timing?: Partial<Timing>;
  keyframes: (ctx: PresetContext) => Keyframe[];
};

// Individual transform properties (translate/scale/rotate) compose with the widget's own CSS.
export const PRESETS: Preset[] = [
  {
    key: "fadeIn",
    label: "Fade in",
    description: "Slowly appears out of nothing.",
    group: "Appear",
    keyframes: () => [{ opacity: 0 }, { opacity: 1 }],
  },
  {
    key: "popIn",
    label: "Pop in",
    description: "Grows from small with a little bounce.",
    group: "Appear",
    timing: { easing: "cubic-bezier(.34,1.56,.64,1)" },
    keyframes: () => [
      { opacity: 0, scale: "0.6" },
      { opacity: 1, scale: "1.05", offset: 0.7 },
      { opacity: 1, scale: "1" },
    ],
  },
  {
    key: "slideUp",
    label: "Rise up",
    description: "Slides up into place from below.",
    group: "Appear",
    timing: { easing: "ease-out" },
    keyframes: () => [
      { opacity: 0, translate: "0 40px" },
      { opacity: 1, translate: "0 0" },
    ],
  },
  {
    key: "slideDown",
    label: "Drop down",
    description: "Slides down into place from above.",
    group: "Appear",
    timing: { easing: "ease-out" },
    keyframes: () => [
      { opacity: 0, translate: "0 -40px" },
      { opacity: 1, translate: "0 0" },
    ],
  },
  {
    key: "slideFromRight",
    label: "Slide from right",
    description: "Glides in from the right side.",
    group: "Appear",
    timing: { easing: "ease-out" },
    keyframes: () => [
      { opacity: 0, translate: "60px 0" },
      { opacity: 1, translate: "0 0" },
    ],
  },
  {
    key: "slideFromLeft",
    label: "Slide from left",
    description: "Glides in from the left side.",
    group: "Appear",
    timing: { easing: "ease-out" },
    keyframes: () => [
      { opacity: 0, translate: "-60px 0" },
      { opacity: 1, translate: "0 0" },
    ],
  },
  {
    key: "pulse",
    label: "Pulse",
    description: "Briefly swells and shrinks back.",
    group: "Get attention",
    keyframes: () => [{ scale: "1" }, { scale: "1.08" }, { scale: "1" }],
  },
  {
    key: "heartbeat",
    label: "Heartbeat",
    description: "Two quick beats, like a heart.",
    group: "Get attention",
    timing: { duration: 1000 },
    keyframes: () => [
      { scale: "1" },
      { scale: "1.14", offset: 0.15 },
      { scale: "1", offset: 0.3 },
      { scale: "1.14", offset: 0.45 },
      { scale: "1", offset: 0.7 },
      { scale: "1" },
    ],
  },
  {
    key: "shake",
    label: "Shake",
    description: "Wobbles side to side — good for alerts.",
    group: "Get attention",
    timing: { duration: 600 },
    keyframes: () => [
      { translate: "0 0" },
      { translate: "-10px 0", offset: 0.15 },
      { translate: "10px 0", offset: 0.3 },
      { translate: "-8px 0", offset: 0.45 },
      { translate: "8px 0", offset: 0.6 },
      { translate: "-4px 0", offset: 0.8 },
      { translate: "0 0" },
    ],
  },
  {
    key: "wiggle",
    label: "Wiggle",
    description: "Tilts back and forth playfully.",
    group: "Get attention",
    timing: { duration: 700 },
    keyframes: () => [
      { rotate: "0deg" },
      { rotate: "-5deg", offset: 0.2 },
      { rotate: "5deg", offset: 0.4 },
      { rotate: "-3deg", offset: 0.6 },
      { rotate: "3deg", offset: 0.8 },
      { rotate: "0deg" },
    ],
  },
  {
    key: "bounce",
    label: "Bounce",
    description: "Hops up and lands twice.",
    group: "Get attention",
    timing: { duration: 900 },
    keyframes: () => [
      { translate: "0 0", easing: "ease-out" },
      { translate: "0 -28px", offset: 0.3, easing: "ease-in" },
      { translate: "0 0", offset: 0.55, easing: "ease-out" },
      { translate: "0 -10px", offset: 0.75, easing: "ease-in" },
      { translate: "0 0" },
    ],
  },
  {
    key: "rubberBand",
    label: "Squish",
    description: "Stretches and squashes like rubber.",
    group: "Get attention",
    timing: { duration: 900 },
    keyframes: () => [
      { scale: "1 1" },
      { scale: "1.2 0.8", offset: 0.3 },
      { scale: "0.85 1.15", offset: 0.45 },
      { scale: "1.08 0.92", offset: 0.65 },
      { scale: "0.98 1.02", offset: 0.8 },
      { scale: "1 1" },
    ],
  },
  {
    key: "flash",
    label: "Flash",
    description: "Blinks on and off quickly.",
    group: "Get attention",
    timing: { duration: 900 },
    keyframes: () => [{ opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }],
  },
  {
    key: "glow",
    label: "Glow",
    description: "Lights up with your highlight colour.",
    group: "Get attention",
    usesCard: true,
    timing: { duration: 1200 },
    keyframes: ({ accent }) => [
      { boxShadow: `0 0 0 0 ${accent}00` },
      { boxShadow: `0 0 48px 8px ${accent}` },
      { boxShadow: `0 0 0 0 ${accent}00` },
    ],
  },
  {
    key: "spin",
    label: "Spin",
    description: "Does one full turn.",
    group: "Get attention",
    keyframes: () => [{ rotate: "0deg" }, { rotate: "360deg" }],
  },
  {
    key: "flip",
    label: "Flip",
    description: "Flips over like a card.",
    group: "Get attention",
    timing: { duration: 900 },
    keyframes: () => [{ rotate: "y 0deg" }, { rotate: "y 360deg" }],
  },
  {
    key: "fadeOut",
    label: "Fade out",
    description: "Slowly disappears. Turn on “Stay at the end” to keep it hidden.",
    group: "Disappear",
    timing: { keepEnd: true },
    keyframes: () => [{ opacity: 1 }, { opacity: 0 }],
  },
  {
    key: "shrinkAway",
    label: "Shrink away",
    description: "Shrinks down to nothing.",
    group: "Disappear",
    timing: { keepEnd: true, easing: "ease-in" },
    keyframes: () => [
      { opacity: 1, scale: "1" },
      { opacity: 0, scale: "0.5" },
    ],
  },
  {
    key: "float",
    label: "Float",
    description: "Drifts gently up and down.",
    group: "Keep moving",
    timing: { duration: 4000, repeat: 0 },
    keyframes: () => [{ translate: "0 0" }, { translate: "0 -12px" }, { translate: "0 0" }],
  },
  {
    key: "breathe",
    label: "Breathe",
    description: "Slowly grows and relaxes.",
    group: "Keep moving",
    timing: { duration: 3500, repeat: 0 },
    keyframes: () => [{ scale: "1" }, { scale: "1.04" }, { scale: "1" }],
  },
  {
    key: "sway",
    label: "Sway",
    description: "Rocks gently from side to side.",
    group: "Keep moving",
    timing: { duration: 3000, repeat: 0 },
    keyframes: () => [{ rotate: "-2deg" }, { rotate: "2deg" }, { rotate: "-2deg" }],
  },
];

export const presetByKey = (key: string) => PRESETS.find((p) => p.key === key);

export const PRESET_GROUPS = ["Appear", "Get attention", "Disappear", "Keep moving"] as const;
