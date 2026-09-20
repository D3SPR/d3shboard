import type { Background, WidgetStyle } from "../lib/types";

/** The parts of a component's look a theme sets. Content and layout are never touched. */
export type CardLook = Pick<WidgetStyle, "bg" | "fg" | "border" | "borderWidth" | "radius" | "shadow" | "blur">;

export type Theme = {
  id: string;
  name: string;
  description: string;
  accent: string;
  fontFamily: string;
  background: Background;
  card: CardLook;
};

const bg = (
  kind: Background["kind"],
  color: string,
  color2 = color,
  angle = 145,
): Background => ({ kind, color, color2, angle, imageUrl: "", imageFit: "cover", dim: 0 });

const card = (
  bgColor: string,
  fg: string,
  border: string,
  extra: Partial<CardLook> = {},
): CardLook => ({ bg: bgColor, fg, border, borderWidth: 1, radius: 18, shadow: "soft", blur: true, ...extra });

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    description: "The d3shboard look: deep purple with frosted cards.",
    accent: "#c7b8ff",
    fontFamily: "Space Grotesk",
    background: bg("gradient", "#0b0a12", "#221a3a"),
    card: card("#15131fE6", "#efedf7", "#ffffff1f"),
  },
  {
    id: "ink",
    name: "Ink",
    description: "Near-black and sharp, with square corners.",
    accent: "#ffffff",
    fontFamily: "JetBrains Mono",
    background: bg("solid", "#08080a"),
    card: card("#111114E6", "#f2f2f4", "#ffffff14", { radius: 6, shadow: "none" }),
  },
  {
    id: "dusk",
    name: "Dusk",
    description: "Warm plum fading to rose.",
    accent: "#ff9ec4",
    fontFamily: "DM Sans",
    background: bg("gradient", "#1b1020", "#5a2740", 160),
    card: card("#241629CC", "#f7ecf2", "#ffffff1f", { radius: 22 }),
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool teal depths.",
    accent: "#6ddbe6",
    fontFamily: "DM Sans",
    background: bg("gradient", "#04131f", "#0d4a63", 160),
    card: card("#0a2231CC", "#e8f6fa", "#8fe3f01f", { radius: 20 }),
  },
  {
    id: "forest",
    name: "Forest",
    description: "Dark green and calm.",
    accent: "#8fe3a6",
    fontFamily: "Space Grotesk",
    background: bg("gradient", "#07140e", "#1f4d33", 150),
    card: card("#0d1f16CC", "#e9f7ee", "#ffffff1a", { radius: 20 }),
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Burnt orange over deep red.",
    accent: "#ffb066",
    fontFamily: "Space Grotesk",
    background: bg("gradient", "#2a0f2e", "#8a3b3b", 135),
    card: card("#26131fCC", "#fdeee2", "#ffffff1f", { radius: 20 }),
  },
  {
    id: "neon",
    name: "Neon",
    description: "Black with an electric glow around every card.",
    accent: "#8cff3d",
    fontFamily: "JetBrains Mono",
    background: bg("solid", "#050608"),
    card: card("#0b0f0cD9", "#e7ffd9", "#8cff3d40", { radius: 10, shadow: "glow", blur: false }),
  },
  {
    id: "vapor",
    name: "Vapour",
    description: "Pink and blue haze.",
    accent: "#ff7ad9",
    fontFamily: "Unbounded",
    background: bg("gradient", "#190b2e", "#0e3a6b", 200),
    card: card("#1d1236CC", "#f4ecff", "#ff7ad933", { radius: 24 }),
  },
  {
    id: "slate",
    name: "Slate",
    description: "Plain grey. Nothing shouts.",
    accent: "#9fb2c9",
    fontFamily: "system-ui",
    background: bg("solid", "#121316"),
    card: card("#1b1d21E6", "#e8eaee", "#ffffff14", { radius: 14, shadow: "none" }),
  },
  {
    id: "paper",
    name: "Paper",
    description: "Light and printed — good in a bright room.",
    accent: "#3c3a35",
    fontFamily: "Playfair Display",
    background: bg("solid", "#e9e4da"),
    card: card("#fdfbf7E6", "#22201c", "#0000001a", { radius: 12, shadow: "soft", blur: false }),
  },
  {
    id: "linen",
    name: "Linen",
    description: "Soft cream with rounded cards.",
    accent: "#c2673f",
    fontFamily: "DM Sans",
    background: bg("gradient", "#f3ece1", "#e2d6c4", 160),
    card: card("#fffaf2F2", "#2e2720", "#00000014", { radius: 24, shadow: "soft", blur: false }),
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Green on black, like an old screen.",
    accent: "#3dff88",
    fontFamily: "JetBrains Mono",
    background: bg("solid", "#000000"),
    card: card("#00140933", "#7dffb4", "#3dff8833", { radius: 4, shadow: "none", blur: false }),
  },
  {
    id: "bold",
    name: "Bold",
    description: "Big type and hard shadows.",
    accent: "#ffd166",
    fontFamily: "Bebas Neue",
    background: bg("solid", "#171313"),
    card: card("#221c1cF2", "#fff6e3", "#ffd16633", { radius: 8, shadow: "hard", blur: false }),
  },
  {
    id: "glass",
    name: "Glass",
    description: "Barely-there cards over a blue wash.",
    accent: "#b8d8ff",
    fontFamily: "DM Sans",
    background: bg("gradient", "#0d1626", "#274060", 170),
    card: card("#ffffff14", "#eef4ff", "#ffffff2e", { radius: 26 }),
  },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? null;
