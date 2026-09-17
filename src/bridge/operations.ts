import { ALL_WIDGETS, TRIGGER_WIDGET, defaultTiming } from "../animations/engine";
import { presetByKey } from "../animations/presets";
import { propertyByKey } from "../animations/properties";
import {
  BREAKPOINTS,
  createPanel,
  createWidget,
  defaultBackground,
  layoutsFrom,
  normalizeDoc,
  rectFor,
  removeWidgetFromPanel,
  uid,
} from "../lib/board";
import type {
  Action,
  AnimationRule,
  Automation,
  BoardDoc,
  BreakpointKey,
  Condition,
  Panel,
  Rect,
  Widget,
  WidgetType,
} from "../lib/types";
import { WIDGET_DEFAULTS } from "../widgets/defaults";
import type { BridgeMethod } from "./protocol";

export class BridgeError extends Error {}

type Params = Record<string, any>;
export type OperationOutcome = { doc: BoardDoc; result: unknown; summary: string | null };

const SCREEN_TO_BP: Record<string, BreakpointKey> = { phone: "sm", tablet: "md", computer: "lg" };
const BP_TO_SCREEN: Record<BreakpointKey, string> = { sm: "phone", md: "tablet", lg: "computer" };

const fail = (message: string): never => {
  throw new BridgeError(message);
};

const findPanel = (doc: BoardDoc, pageId?: string) => {
  const id = pageId ?? doc.activePanelId;
  return doc.panels.find((p) => p.id === id) ?? fail(`No page with id "${id}". Call get_dashboard to see page ids.`);
};

const findWidget = (doc: BoardDoc, widgetId: string) => {
  for (const panel of doc.panels) {
    const widget = panel.widgets.find((w) => w.id === widgetId);
    if (widget) return { panel, widget };
  }
  return fail(`No component with id "${widgetId}". Call get_dashboard to see component ids.`);
};

const replacePanel = (doc: BoardDoc, panel: Panel): BoardDoc => ({
  ...doc,
  panels: doc.panels.map((p) => (p.id === panel.id ? panel : p)),
});

const defined = <T extends object>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

const friendlyWidget = (w: Widget) => ({
  id: w.id,
  type: w.type,
  title: w.title,
  showTitle: w.showTitle,
  locked: w.locked,
  z: w.z,
  layouts: Object.fromEntries(BREAKPOINTS.map((b) => [BP_TO_SCREEN[b.key], rectFor(w, b.key)])),
  config: w.config,
  style: w.style,
});

const friendlyDoc = (doc: BoardDoc) => ({
  mode: doc.mode === "edit" ? "editing" : "viewing",
  activePageId: doc.activePanelId,
  screens: Object.fromEntries(BREAKPOINTS.map((b) => [BP_TO_SCREEN[b.key], { width: b.width }])),
  pages: doc.panels.map((p) => ({
    id: p.id,
    name: p.name,
    accent: p.accent,
    fontFamily: p.fontFamily,
    background: p.background,
    snap: p.snap,
    gridSize: p.gridSize,
    showGrid: p.showGrid,
    widgets: p.widgets.map(friendlyWidget),
    animations: p.animations,
  })),
  automations: doc.automations,
});

const pagePatch = (params: Params): Partial<Panel> => {
  const patch = defined({
    name: params.name,
    accent: params.accent,
    fontFamily: params.fontFamily,
    snap: params.snap,
    gridSize: params.gridSize,
    showGrid: params.showGrid,
  }) as Partial<Panel>;
  return patch;
};

function checkAnimationRefs(panel: Panel, rule: AnimationRule, automations: Automation[]) {
  const ids = new Set(panel.widgets.map((w) => w.id));
  const t = rule.trigger;
  if ("widgetId" in t && !ids.has(t.widgetId))
    fail(`Trigger component "${t.widgetId}" isn't on page "${panel.name}". Animations only reference components on their own page.`);
  if (t.kind === "automation" && !automations.some((a) => a.id === t.automationId))
    fail(`No automation with id "${t.automationId}".`);
  const target = rule.target.widgetId;
  if (target === TRIGGER_WIDGET && !("widgetId" in t))
    fail(`target.widgetId "${TRIGGER_WIDGET}" only works with click, hover or dataChange triggers.`);
  if (target !== TRIGGER_WIDGET && target !== ALL_WIDGETS && !ids.has(target))
    fail(`Target component "${target}" isn't on page "${panel.name}".`);
  if (rule.effect.kind === "preset" && !presetByKey(rule.effect.preset))
    fail(`Unknown preset "${rule.effect.preset}". Call get_guide for the list.`);
  if (rule.effect.kind === "property" && !propertyByKey(rule.effect.property))
    fail(`Unknown property "${rule.effect.property}". Call get_guide for the list.`);
}

function checkAutomationRefs(doc: BoardDoc, actions: Action[]) {
  for (const a of actions) {
    if (a.kind === "setPanel" && !doc.panels.some((p) => p.id === a.panelId)) fail(`No page with id "${a.panelId}".`);
    if (a.kind === "setWidgetVisible" && !doc.panels.some((p) => p.widgets.some((w) => w.id === a.widgetId)))
      fail(`No component with id "${a.widgetId}".`);
  }
}

const normalizeActions = (actions: Action[]): Action[] =>
  actions.map((a) => (a.kind === "setBackground" ? { ...a, background: { ...defaultBackground(), ...a.background } } : a));

const findAnimation = (doc: BoardDoc, id: string) => {
  for (const panel of doc.panels) {
    const rule = panel.animations.find((a) => a.id === id);
    if (rule) return { panel, rule };
  }
  return fail(`No animation with id "${id}".`);
};

export function runOperation(doc: BoardDoc, method: Exclude<BridgeMethod, "undo">, params: Params): OperationOutcome {
  switch (method) {
    case "getDashboard":
      return { doc, result: params.raw ? doc : friendlyDoc(doc), summary: null };

    case "addPage": {
      const panel: Panel = {
        ...createPanel(params.name ?? `Page ${doc.panels.length + 1}`),
        ...pagePatch(params),
      };
      if (params.background) panel.background = { ...panel.background, ...params.background };
      const next = { ...doc, panels: [...doc.panels, panel], activePanelId: params.show === false ? doc.activePanelId : panel.id };
      return { doc: next, result: { pageId: panel.id }, summary: `Added page “${panel.name}”` };
    }

    case "updatePage": {
      const panel = findPanel(doc, params.pageId);
      const updated: Panel = { ...panel, ...pagePatch(params) };
      if (params.background) updated.background = { ...panel.background, ...params.background };
      return { doc: replacePanel(doc, updated), result: { pageId: panel.id }, summary: `Updated page “${updated.name}”` };
    }

    case "deletePage": {
      const panel = findPanel(doc, params.pageId);
      if (doc.panels.length < 2) fail("Can't delete the only page.");
      const panels = doc.panels.filter((p) => p.id !== panel.id);
      return {
        doc: { ...doc, panels, activePanelId: doc.activePanelId === panel.id ? panels[0].id : doc.activePanelId },
        result: { deleted: panel.id },
        summary: `Deleted page “${panel.name}”`,
      };
    }

    case "setView": {
      let next = doc;
      if (params.pageId) next = { ...next, activePanelId: findPanel(doc, params.pageId).id };
      if (params.mode) next = { ...next, mode: params.mode === "viewing" ? "display" : "edit" };
      return { doc: next, result: { activePageId: next.activePanelId, mode: params.mode ?? null }, summary: "Changed what's showing" };
    }

    case "addWidget": {
      const panel = findPanel(doc, params.pageId);
      const type = params.type as WidgetType;
      if (!WIDGET_DEFAULTS[type]) fail(`Unknown component type "${type}".`);
      const z = Math.max(0, ...panel.widgets.map((w) => w.z)) + 1;
      const base = params.layout ?? {};
      const def = WIDGET_DEFAULTS[type];
      let widget = createWidget(type, base.x ?? 40, base.y ?? 40, z);
      widget = {
        ...widget,
        layouts: layoutsFrom(base.x ?? 40, base.y ?? 40, base.w ?? def.w, base.h ?? def.h),
        ...defined({ title: params.title, showTitle: params.showTitle, locked: params.locked }),
        config: { ...widget.config, ...(params.config ?? {}) },
        style: { ...widget.style, ...(params.style ?? {}) },
      };
      for (const [screen, rect] of Object.entries((params.layouts ?? {}) as Record<string, Partial<Rect>>)) {
        const bp = SCREEN_TO_BP[screen] ?? fail(`Unknown screen "${screen}". Use phone, tablet or computer.`);
        widget.layouts[bp] = { ...widget.layouts[bp], ...rect };
      }
      return {
        doc: replacePanel(doc, { ...panel, widgets: [...panel.widgets, widget] }),
        result: friendlyWidget(widget),
        summary: `Added ${type} “${widget.title}”`,
      };
    }

    case "updateWidget": {
      const { panel, widget } = findWidget(doc, params.widgetId);
      const updated: Widget = {
        ...widget,
        ...defined({ title: params.title, showTitle: params.showTitle, locked: params.locked, z: params.z }),
        config: params.config ? { ...widget.config, ...params.config } : widget.config,
        style: params.style ? { ...widget.style, ...params.style } : widget.style,
      };
      if (params.bringToFront) updated.z = Math.max(...panel.widgets.map((w) => w.z)) + 1;
      return {
        doc: replacePanel(doc, { ...panel, widgets: panel.widgets.map((w) => (w.id === widget.id ? updated : w)) }),
        result: friendlyWidget(updated),
        summary: `Updated “${updated.title}”`,
      };
    }

    case "setWidgetLayout": {
      const { panel, widget } = findWidget(doc, params.widgetId);
      const screens: BreakpointKey[] =
        params.screen === "all" ? ["sm", "md", "lg"] : [SCREEN_TO_BP[params.screen] ?? fail(`Unknown screen "${params.screen}".`)];
      const patch = defined({ x: params.x, y: params.y, w: params.w, h: params.h, hidden: params.hidden }) as Partial<Rect>;
      if (patch.w !== undefined && patch.w < 80) fail("Width must be at least 80px.");
      if (patch.h !== undefined && patch.h < 60) fail("Height must be at least 60px.");
      const layouts = { ...widget.layouts };
      screens.forEach((bp) => (layouts[bp] = { ...rectFor(widget, bp), ...patch }));
      const updated = { ...widget, layouts };
      return {
        doc: replacePanel(doc, { ...panel, widgets: panel.widgets.map((w) => (w.id === widget.id ? updated : w)) }),
        result: friendlyWidget(updated),
        summary: `Moved “${widget.title}” (${params.screen})`,
      };
    }

    case "deleteWidget": {
      const { panel, widget } = findWidget(doc, params.widgetId);
      return {
        doc: replacePanel(doc, removeWidgetFromPanel(panel, widget.id)),
        result: { deleted: widget.id },
        summary: `Deleted “${widget.title}”`,
      };
    }

    case "addAnimation": {
      const panel = findPanel(doc, params.pageId);
      const preset = params.effect?.kind === "preset" ? presetByKey(params.effect.preset) : undefined;
      const rule: AnimationRule = {
        id: uid(),
        name: params.name ?? "Animation",
        enabled: params.enabled ?? true,
        trigger: params.trigger,
        target: { part: "whole", ...params.target },
        effect: params.effect,
        timing: { ...defaultTiming(), ...preset?.timing, ...(params.timing ?? {}) },
      };
      checkAnimationRefs(panel, rule, doc.automations);
      return {
        doc: replacePanel(doc, { ...panel, animations: [...panel.animations, rule] }),
        result: { animationId: rule.id, rule },
        summary: `Added animation “${rule.name}”`,
      };
    }

    case "updateAnimation": {
      const { panel, rule } = findAnimation(doc, params.animationId);
      const updated: AnimationRule = {
        ...rule,
        ...defined({ name: params.name, enabled: params.enabled, trigger: params.trigger, effect: params.effect }),
        target: params.target ? { ...rule.target, ...params.target } : rule.target,
        timing: params.timing ? { ...rule.timing, ...params.timing } : rule.timing,
      };
      checkAnimationRefs(panel, updated, doc.automations);
      return {
        doc: replacePanel(doc, { ...panel, animations: panel.animations.map((a) => (a.id === rule.id ? updated : a)) }),
        result: { rule: updated },
        summary: `Updated animation “${updated.name}”`,
      };
    }

    case "deleteAnimation": {
      const { panel, rule } = findAnimation(doc, params.animationId);
      return {
        doc: replacePanel(doc, { ...panel, animations: panel.animations.filter((a) => a.id !== rule.id) }),
        result: { deleted: rule.id },
        summary: `Deleted animation “${rule.name}”`,
      };
    }

    case "addAutomation": {
      const actions = normalizeActions(params.actions as Action[]);
      checkAutomationRefs(doc, actions);
      const rule: Automation = {
        id: uid(),
        name: params.name ?? `Rule ${doc.automations.length + 1}`,
        enabled: params.enabled ?? true,
        conditions: params.conditions as Condition[],
        actions,
      };
      return {
        doc: { ...doc, automations: [...doc.automations, rule] },
        result: { automationId: rule.id, rule },
        summary: `Added automation “${rule.name}”`,
      };
    }

    case "updateAutomation": {
      const rule = doc.automations.find((a) => a.id === params.automationId) ?? fail(`No automation with id "${params.automationId}".`);
      const actions = params.actions ? normalizeActions(params.actions) : rule.actions;
      checkAutomationRefs(doc, actions);
      const updated: Automation = {
        ...rule,
        ...defined({ name: params.name, enabled: params.enabled, conditions: params.conditions }),
        actions,
      };
      return {
        doc: { ...doc, automations: doc.automations.map((a) => (a.id === rule.id ? updated : a)) },
        result: { rule: updated },
        summary: `Updated automation “${updated.name}”`,
      };
    }

    case "deleteAutomation": {
      const rule = doc.automations.find((a) => a.id === params.automationId) ?? fail(`No automation with id "${params.automationId}".`);
      return {
        doc: { ...doc, automations: doc.automations.filter((a) => a.id !== rule.id) },
        result: { deleted: rule.id },
        summary: `Deleted automation “${rule.name}”`,
      };
    }

    case "replaceDashboard": {
      if (!params.document || typeof params.document !== "object") fail("document must be a dashboard backup object.");
      const next = normalizeDoc(params.document);
      return { doc: next, result: friendlyDoc(next), summary: "Replaced the whole dashboard" };
    }

    default:
      return fail(`Unknown method "${method}".`);
  }
}
