import type { DataSource } from "../data/types";

export type BreakpointKey = "sm" | "md" | "lg";

export type Rect = { x: number; y: number; w: number; h: number; hidden: boolean };

export type WidgetType = "clock" | "text" | "image" | "iframe" | "feed" | "api" | "embed";

export type Shadow = "none" | "soft" | "hard" | "glow";
export type IdleAnimation = "none" | "float" | "pulse" | "fade" | "slide";

export type WidgetStyle = {
  bg: string;
  fg: string;
  border: string;
  borderWidth: number;
  radius: number;
  padding: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  align: "left" | "center" | "right";
  opacity: number;
  shadow: Shadow;
  animation: IdleAnimation;
  blur: boolean;
  autoFit: boolean;
};

export type WidgetConfig = Record<string, string | number>;

export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  showTitle: boolean;
  z: number;
  locked: boolean;
  layouts: Record<BreakpointKey, Rect>;
  style: WidgetStyle;
  config: WidgetConfig;
};

export type Background = {
  kind: "solid" | "gradient" | "image";
  color: string;
  color2: string;
  angle: number;
  imageUrl: string;
  imageFit: "cover" | "contain" | "repeat";
  dim: number;
};

export type Panel = {
  id: string;
  name: string;
  snap: boolean;
  gridSize: number;
  showGrid: boolean;
  fontFamily: string;
  accent: string;
  background: Background;
  widgets: Widget[];
  animations: AnimationRule[];
};

export type Condition =
  | { kind: "timeRange"; from: string; to: string }
  | { kind: "weekday"; days: number[] }
  | { kind: "monthday"; days: number[] }
  | { kind: "month"; months: number[] }
  | { kind: "dataValue"; url: string; path: string; op: DataOp; value: string };

export type DataOp = "is" | "isNot" | "contains" | "gt" | "lt";

export type Action =
  | { kind: "setPanel"; panelId: string }
  | { kind: "setAccent"; color: string }
  | { kind: "setFont"; fontFamily: string }
  | { kind: "setBackground"; background: Background }
  | { kind: "setWidgetVisible"; widgetId: string; visible: boolean };

export type Automation = {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Condition[];
  actions: Action[];
};

export type AnimationTrigger =
  | { kind: "pageShown" }
  | { kind: "loop" }
  | { kind: "click"; widgetId: string }
  | { kind: "hover"; widgetId: string }
  | { kind: "every"; seconds: number }
  | { kind: "timeOfDay"; at: string }
  | { kind: "dataChange"; widgetId: string }
  | { kind: "automation"; automationId: string };

export type AnimationPart = "whole" | "card" | "title" | "content";

export type AnimationTarget = {
  widgetId: string;
  part: AnimationPart;
};

export type Timing = {
  duration: number;
  delay: number;
  easing: string;
  repeat: number;
  alternate: boolean;
  keepEnd: boolean;
};

export type AnimationEffect =
  | { kind: "preset"; preset: string }
  | { kind: "property"; property: string; from: string; to: string }
  | { kind: "custom"; html: string; css: string; js: string };

export type AnimationRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AnimationTrigger;
  target: AnimationTarget;
  effect: AnimationEffect;
  timing: Timing;
};

export type Mode = "edit" | "display";

export type BoardDoc = {
  version: 5;
  mode: Mode;
  panels: Panel[];
  activePanelId: string;
  automations: Automation[];
  /** Data sources the whole dashboard shares, so one fetch feeds every component using it. */
  sources: DataSource[];
};

export type RenderBoard = Panel & { mode: Mode };
