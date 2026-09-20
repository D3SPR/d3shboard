import type { WidgetType } from "../lib/types";
import type { IconName } from "../ui/icons";

export const WIDGET_CATALOG: { type: WidgetType; label: string; description: string; icon: IconName }[] = [
  { type: "clock", label: "Clock", description: "Shows the time and date, in any time zone.", icon: "clock" },
  { type: "text", label: "Note", description: "A box of your own writing — reminders, quotes, anything.", icon: "text" },
  { type: "image", label: "Picture", description: "Show any picture from the internet using its link.", icon: "image" },
  { type: "feed", label: "News headlines", description: "Latest headlines from a news site, updated automatically.", icon: "news" },
  { type: "api", label: "Live number", description: "Show a live value like a price or temperature from a data link.", icon: "gauge" },
  { type: "iframe", label: "Web page", description: "Show a whole website inside a box.", icon: "globe" },
  { type: "embed", label: "Custom code", description: "For tinkerers: write your own HTML and JavaScript.", icon: "code" },
  { type: "component", label: "Component", description: "A ready-made design from the component library.", icon: "layers" },
];

/** The simple building blocks, shown under "Basics" in the Add dialog. */
export const ADDABLE_CATALOG = WIDGET_CATALOG.filter((c) => c.type !== "component");

export const catalogEntry = (type: WidgetType) => WIDGET_CATALOG.find((c) => c.type === type)!;
