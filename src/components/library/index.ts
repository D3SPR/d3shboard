import type { ComponentCategory, ComponentDef } from "../types";
import { BASIC_COMPONENTS } from "./basics.ts";
import { NEWS_COMPONENTS } from "./news.ts";
import { SPORTS_COMPONENTS } from "./sports.ts";
import { TIME_COMPONENTS } from "./time.ts";
import { WEATHER_COMPONENTS } from "./weather.ts";

/** Everything in the component library, in the order the browser shows it. */
export const COMPONENTS: ComponentDef[] = [
  ...TIME_COMPONENTS,
  ...WEATHER_COMPONENTS,
  ...NEWS_COMPONENTS,
  ...SPORTS_COMPONENTS,
  ...BASIC_COMPONENTS,
];

export const CATEGORIES: ComponentCategory[] = ["Time", "Weather", "News", "Sports", "Numbers", "Text & shapes"];

export const definitionFor = (id: string) => COMPONENTS.find((c) => c.id === id) ?? null;

export const componentsIn = (category: ComponentCategory) => COMPONENTS.filter((c) => c.category === category);
