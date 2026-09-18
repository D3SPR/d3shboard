import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { PRESETS } from "../src/animations/presets.ts";
import { PROPERTIES } from "../src/animations/properties.ts";
import { FONTS } from "../src/lib/board.ts";
import type { BridgeMethod } from "../src/bridge/protocol.ts";
import { buildGuide } from "./guide.ts";

export type Call = (method: BridgeMethod, params: Record<string, unknown>) => Promise<CallToolResult>;

const keys = <T extends { key: string }>(items: T[]) => items.map((i) => i.key) as [string, ...string[]];

const pageId = z.string().optional().describe("Page id. Omit to use the page currently open in the editor.");
const widgetType = z.enum(["clock", "text", "image", "iframe", "feed", "api", "embed"]);
const screen = z.enum(["phone", "tablet", "computer"]);

const rect = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().min(80).optional(),
  h: z.number().min(60).optional(),
  hidden: z.boolean().optional(),
});

const style = z
  .object({
    bg: z.string().describe("Any CSS background; 8-digit hex for transparency."),
    fg: z.string().describe("Text colour."),
    border: z.string().describe("Border colour."),
    borderWidth: z.number().min(0).max(12),
    radius: z.number().min(0).max(60),
    padding: z.number().min(0).max(120).describe("Ignored while autoFit is on; setting it turns autoFit off."),
    fontFamily: z.string().describe(`"inherit" or one of: ${FONTS.join(", ")}`),
    fontSize: z.number().min(6).max(240).describe("Ignored while autoFit is on; setting it turns autoFit off."),
    fontWeight: z.number().min(100).max(900),
    letterSpacing: z.number().min(-3).max(12),
    align: z.enum(["left", "center", "right"]).describe("Ignored while autoFit is on; setting it turns autoFit off."),
    opacity: z.number().min(0.1).max(1),
    shadow: z.enum(["none", "soft", "hard", "glow"]),
    animation: z.enum(["none", "float", "pulse", "fade", "slide"]).describe("Gentle idle loop."),
    blur: z.boolean().describe("Frosted glass."),
    autoFit: z
      .boolean()
      .describe("On by default for new components: text size and padding scale with the box and content is centred."),
  })
  .partial();

const background = z
  .object({
    kind: z.enum(["solid", "gradient", "image"]),
    color: z.string(),
    color2: z.string(),
    angle: z.number(),
    imageUrl: z.string(),
    imageFit: z.enum(["cover", "contain", "repeat"]),
    dim: z.number().min(0).max(0.8),
  })
  .partial();

const pageFields = {
  name: z.string().optional(),
  accent: z.string().optional().describe("Hex colour used for highlights and glow."),
  fontFamily: z.enum(FONTS as [string, ...string[]]).optional(),
  background: background.optional(),
  snap: z.boolean().optional(),
  gridSize: z.number().min(5).max(80).optional(),
  showGrid: z.boolean().optional(),
};

const trigger = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pageShown") }),
  z.object({ kind: z.literal("loop") }),
  z.object({ kind: z.literal("click"), widgetId: z.string() }),
  z.object({ kind: z.literal("hover"), widgetId: z.string() }),
  z.object({ kind: z.literal("every"), seconds: z.number().min(1) }),
  z.object({ kind: z.literal("timeOfDay"), at: z.string().regex(/^\d{2}:\d{2}$/).describe("HH:MM") }),
  z.object({ kind: z.literal("dataChange"), widgetId: z.string().describe("A feed or api component.") }),
  z.object({ kind: z.literal("automation"), automationId: z.string() }),
]);

const target = z.object({
  widgetId: z.string().describe('Component id, "@trigger" (component that fired a click/hover/dataChange trigger) or "@all".'),
  part: z.enum(["whole", "card", "title", "content"]).optional(),
});

const effect = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preset"), preset: z.enum(keys(PRESETS)) }),
  z.object({
    kind: z.literal("property"),
    property: z.enum(keys(PROPERTIES)),
    from: z.string().describe('Start value, or "" to start from the current look.'),
    to: z.string(),
  }),
  z.object({
    kind: z.literal("custom"),
    html: z.string().default(""),
    css: z.string().default("").describe("Use .target and .overlay selectors; see get_guide."),
    js: z.string().default("").describe("Function body receiving el, overlay, api."),
  }),
]);

const timing = z
  .object({
    duration: z.number().min(1).describe("Milliseconds."),
    delay: z.number().min(0).describe("Milliseconds."),
    easing: z.string().describe("CSS easing."),
    repeat: z.number().int().min(0).describe("0 = forever."),
    alternate: z.boolean(),
    keepEnd: z.boolean().describe("Hold the final frame."),
  })
  .partial();

const time = z.string().regex(/^\d{2}:\d{2}$/);
const condition = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("timeRange"), from: time, to: time }),
  z.object({ kind: z.literal("weekday"), days: z.array(z.number().int().min(0).max(6)).describe("0 = Sunday.") }),
  z.object({ kind: z.literal("monthday"), days: z.array(z.number().int().min(1).max(31)) }),
  z.object({ kind: z.literal("month"), months: z.array(z.number().int().min(1).max(12)) }),
  z.object({
    kind: z.literal("dataValue"),
    url: z.string(),
    path: z.string(),
    op: z.enum(["is", "isNot", "contains", "gt", "lt"]),
    value: z.string(),
  }),
]);

const action = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("setPanel"), panelId: z.string().describe("Page id to show.") }),
  z.object({ kind: z.literal("setAccent"), color: z.string() }),
  z.object({ kind: z.literal("setFont"), fontFamily: z.enum(FONTS as [string, ...string[]]) }),
  z.object({ kind: z.literal("setBackground"), background }),
  z.object({ kind: z.literal("setWidgetVisible"), widgetId: z.string(), visible: z.boolean() }),
]);

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

export function registerTools(server: McpServer, call: Call) {
  server.registerTool(
    "get_guide",
    {
      title: "Read the d3shboard building guide",
      description:
        "Read this first. Explains how dashboards are structured, the layout system, every component type and its settings, styling, animation presets and triggers, and automation rules.",
      annotations: READ,
    },
    async () => ({ content: [{ type: "text", text: buildGuide() }] }),
  );

  server.registerTool(
    "get_dashboard",
    {
      title: "Get the current dashboard",
      description:
        "Returns every page with its theme, components (ids, layouts per screen, settings, style), animations, and the dashboard's automations. Use raw: true for the exact backup file format used by replace_dashboard.",
      inputSchema: { raw: z.boolean().optional() },
      annotations: READ,
    },
    (args) => call("getDashboard", args),
  );

  server.registerTool(
    "add_page",
    {
      title: "Add a page",
      description: "Adds a new page and (unless show is false) opens it in the editor. Returns its pageId.",
      inputSchema: { ...pageFields, show: z.boolean().optional() },
      annotations: WRITE,
    },
    (args) => call("addPage", args),
  );

  server.registerTool(
    "update_page",
    {
      title: "Update a page's name or theme",
      description: "Changes a page's name, accent colour, font, background (merged) or grid settings.",
      inputSchema: { pageId, ...pageFields },
      annotations: WRITE,
    },
    (args) => call("updatePage", args),
  );

  server.registerTool(
    "delete_page",
    {
      title: "Delete a page",
      description: "Deletes a page and everything on it. The last remaining page can't be deleted.",
      inputSchema: { pageId: z.string() },
      annotations: DESTRUCTIVE,
    },
    (args) => call("deletePage", args),
  );

  server.registerTool(
    "set_view",
    {
      title: "Change what the user sees",
      description:
        'Opens a page and/or switches between "editing" (the editor) and "viewing" (the finished dashboard, where animations and automations run).',
      inputSchema: { pageId: z.string().optional(), mode: z.enum(["editing", "viewing"]).optional() },
      annotations: WRITE,
    },
    (args) => call("setView", args),
  );

  server.registerTool(
    "add_widget",
    {
      title: "Add a component",
      description:
        "Adds a component to a page. `layout` sets the computer position and auto-fits phone/tablet; `layouts` overrides specific screens. `config` and `style` are merged over the type's defaults (see get_guide).",
      inputSchema: {
        pageId,
        type: widgetType,
        title: z.string().optional(),
        showTitle: z.boolean().optional(),
        locked: z.boolean().optional(),
        layout: z.object({ x: z.number(), y: z.number(), w: z.number().min(80), h: z.number().min(60) }).partial().optional(),
        layouts: z.object({ phone: rect, tablet: rect, computer: rect }).partial().optional(),
        config: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
        style: style.optional(),
      },
      annotations: WRITE,
    },
    (args) => call("addWidget", args),
  );

  server.registerTool(
    "update_widget",
    {
      title: "Update a component",
      description: "Changes a component's title, settings (config, merged), style (merged), lock state or stacking order.",
      inputSchema: {
        widgetId: z.string(),
        title: z.string().optional(),
        showTitle: z.boolean().optional(),
        locked: z.boolean().optional(),
        z: z.number().optional(),
        bringToFront: z.boolean().optional(),
        config: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
        style: style.optional(),
      },
      annotations: WRITE,
    },
    (args) => call("updateWidget", args),
  );

  server.registerTool(
    "set_widget_layout",
    {
      title: "Move, resize or hide a component on a screen size",
      description: 'Updates position/size/hidden for one screen ("phone", "tablet", "computer") or "all". Only given fields change.',
      inputSchema: { widgetId: z.string(), screen: z.union([screen, z.literal("all")]), ...rect.shape },
      annotations: WRITE,
    },
    (args) => call("setWidgetLayout", args),
  );

  server.registerTool(
    "delete_widget",
    {
      title: "Delete a component",
      description: "Deletes a component and any animations that reference it.",
      inputSchema: { widgetId: z.string() },
      annotations: DESTRUCTIVE,
    },
    (args) => call("deleteWidget", args),
  );

  server.registerTool(
    "add_animation",
    {
      title: "Add an animation",
      description:
        "Adds an animation to a page: when it plays (trigger), what moves (target) and how (effect: a preset, a property change, or custom HTML/CSS/JS). Referenced components must be on the same page. See get_guide for presets and properties.",
      inputSchema: {
        pageId,
        name: z.string().optional(),
        enabled: z.boolean().optional(),
        trigger,
        target,
        effect,
        timing: timing.optional(),
      },
      annotations: WRITE,
    },
    (args) => call("addAnimation", args),
  );

  server.registerTool(
    "update_animation",
    {
      title: "Update an animation",
      description: "Changes an animation. trigger and effect are replaced; target and timing are merged.",
      inputSchema: {
        animationId: z.string(),
        name: z.string().optional(),
        enabled: z.boolean().optional(),
        trigger: trigger.optional(),
        target: target.partial().optional(),
        effect: effect.optional(),
        timing: timing.optional(),
      },
      annotations: WRITE,
    },
    (args) => call("updateAnimation", args),
  );

  server.registerTool(
    "delete_animation",
    { title: "Delete an animation", inputSchema: { animationId: z.string() }, annotations: DESTRUCTIVE },
    (args) => call("deleteAnimation", args),
  );

  server.registerTool(
    "add_automation",
    {
      title: "Add an automation rule",
      description:
        "Adds a rule that applies its actions while all its conditions are true (in viewing mode), e.g. a dark background between 22:00 and 06:00.",
      inputSchema: {
        name: z.string().optional(),
        enabled: z.boolean().optional(),
        conditions: z.array(condition).min(1),
        actions: z.array(action).min(1),
      },
      annotations: WRITE,
    },
    (args) => call("addAutomation", args),
  );

  server.registerTool(
    "update_automation",
    {
      title: "Update an automation rule",
      description: "Changes a rule. conditions and actions, when given, replace the existing lists.",
      inputSchema: {
        automationId: z.string(),
        name: z.string().optional(),
        enabled: z.boolean().optional(),
        conditions: z.array(condition).min(1).optional(),
        actions: z.array(action).min(1).optional(),
      },
      annotations: WRITE,
    },
    (args) => call("updateAutomation", args),
  );

  server.registerTool(
    "delete_automation",
    { title: "Delete an automation rule", inputSchema: { automationId: z.string() }, annotations: DESTRUCTIVE },
    (args) => call("deleteAutomation", args),
  );

  server.registerTool(
    "replace_dashboard",
    {
      title: "Replace the whole dashboard",
      description:
        "Replaces everything with a dashboard in backup-file format (as returned by get_dashboard with raw: true). Use for large rebuilds; prefer the smaller tools for edits. Can be undone with undo_last_change.",
      inputSchema: { document: z.record(z.string(), z.unknown()) },
      annotations: DESTRUCTIVE,
    },
    (args) => call("replaceDashboard", args),
  );

  server.registerTool(
    "list_templates",
    {
      title: "List ready-made dashboard layouts",
      description:
        "Ready-made pages you can drop in and then adapt: what each one is for and what it contains. Starting from one is usually better than building from an empty page.",
      annotations: READ,
    },
    () => call("listTemplates", {}),
  );

  server.registerTool(
    "apply_template",
    {
      title: "Add a page from a template",
      description:
        "Creates a new page from a template, laid out for computer, tablet and phone, and opens it. Existing pages are untouched. Adapt it afterwards with update_widget / set_widget_layout.",
      inputSchema: {
        templateId: z.string().describe("From list_templates."),
        name: z.string().optional().describe("Name for the new page."),
        show: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    (args) => call("applyTemplate", args),
  );

  server.registerTool(
    "check_dashboard",
    {
      title: "Check a page for problems",
      description:
        "Inspects a page and reports what is wrong: components off the edge or below the fold, overlaps, unreadable colour combinations, missing settings, feeds or live values that failed to load, content cut off, and errors thrown inside custom panels. Call this after building or editing — you cannot see the dashboard, and this is how you find out what actually rendered. Live rendering is only inspected for the page currently on screen (use set_view first).",
      inputSchema: {
        pageId: z.string().optional().describe("Defaults to the page that is open."),
        screen: z.enum(["phone", "tablet", "computer"]).optional().describe("Defaults to checking all three."),
      },
      annotations: READ,
    },
    (args) => call("checkDashboard", args),
  );

  server.registerTool(
    "undo_last_change",
    {
      title: "Undo the last agent change",
      description: "Reverts the most recent change made through this bridge (up to 30 steps back).",
      annotations: WRITE,
    },
    () => call("undo", {}),
  );
}
