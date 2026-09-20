import { ALL_WIDGETS, TRIGGER_WIDGET, defaultTiming } from "../animations/engine";
import { presetByKey } from "../animations/presets";
import { propertyByKey } from "../animations/properties";
import {
  createComponentWidget,
  createPanel,
  createWidget,
  defaultBackground,
  effectiveStyle,
  layoutsFrom,
  normalizeDoc,
  rectFor,
  removeWidgetFromPanel,
  screensOf,
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
import { COMPONENTS, definitionFor } from "../components/library";
import { formatValue } from "../data/format";
import { liveData } from "../data/live";
import { SOURCE_KINDS, createSource, defaultParams, sourceKind } from "../data/registry";
import type { DataSource } from "../data/types";
import { THEMES, themeById } from "../themes";
import { TEMPLATES, buildTemplate, templateContents, templateById } from "../templates";
import { WIDGET_DEFAULTS } from "../widgets/defaults";
import { checkDashboard } from "./diagnostics";
import type { BridgeMethod } from "./protocol";

export class BridgeError extends Error {}

type Params = Record<string, any>;
export type OperationOutcome = { doc: BoardDoc; result: unknown; summary: string | null };

const SCREEN_TO_BP: Record<string, BreakpointKey> = { phone: "sm", tablet: "md", computer: "lg" };
const BP_TO_SCREEN: Record<BreakpointKey, string> = { sm: "phone", md: "tablet", lg: "computer" };

/** Built-in screens keep their friendly names; ones people added go by their own key. */
const screenName = (key: BreakpointKey) => BP_TO_SCREEN[key] ?? key;
const screenKey = (name: string, doc: BoardDoc) =>
  SCREEN_TO_BP[name] ?? (screensOf(doc).some((s) => s.key === name) ? name : null);

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

const MANUAL_SIZING_KEYS = ["fontSize", "padding", "align"];

// Setting a size or alignment by hand is an override, same as in the editor: auto-fit turns off unless asked otherwise.
const withOverride = (style: Params | undefined) =>
  style && style.autoFit === undefined && MANUAL_SIZING_KEYS.some((k) => k in style) ? { ...style, autoFit: false } : style;

const friendlyWidget = (w: Widget) => ({
  id: w.id,
  type: w.type,
  title: w.title,
  showTitle: w.showTitle,
  locked: w.locked,
  z: w.z,
  layouts: Object.fromEntries(Object.keys(w.layouts ?? {}).map((key) => [screenName(key), rectFor(w, key)])),
  config: w.config,
  style: w.style,
  ...(w.component
    ? {
        component: {
          design: w.component.defId,
          dataSources: w.component.sources,
          settings: w.component.params,
          customDesign: !!w.component.tree,
        },
      }
    : {}),
  ...(w.style.autoFit
    ? {
        autoFitResult: Object.fromEntries(
          Object.keys(w.layouts ?? {}).map((key) => {
            const s = effectiveStyle(w, rectFor(w, key));
            return [screenName(key), { fontSize: s.fontSize, padding: s.padding, align: s.align }];
          }),
        ),
      }
    : {}),
});

const friendlyDoc = (doc: BoardDoc) => ({
  mode: doc.mode === "edit" ? "editing" : "viewing",
  activePageId: doc.activePanelId,
  screens: Object.fromEntries(
    screensOf(doc).map((b) => [screenName(b.key), { width: b.width, height: b.height, name: b.label }]),
  ),
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
  dataSources: doc.sources.map((s) => ({ id: s.id, kind: s.kind, name: s.name, settings: s.params })),
});

/** Points a component's slots at existing sources of the right kind, creating any that are missing. */
function fillSlots(sources: DataSource[], needs: { key: string; kind: string; optional?: boolean }[]) {
  const next = [...sources];
  const slots: Record<string, string> = {};
  for (const need of needs) {
    let found = next.find((s) => s.kind === need.kind);
    // Optional slots are left empty unless a matching source already exists.
    if (!found && !need.optional) {
      const created = createSource(need.kind);
      if (created) {
        next.push(created);
        found = created;
      }
    }
    if (found) slots[need.key] = found.id;
  }
  return { sources: next, slots };
}

const findSource = (doc: BoardDoc, id: string) =>
  doc.sources.find((s) => s.id === id) ?? fail(`No data source with id "${id}". Call list_data_sources.`);

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
        style: { ...widget.style, ...(withOverride(params.style) ?? {}) },
      };
      for (const [screen, rect] of Object.entries((params.layouts ?? {}) as Record<string, Partial<Rect>>)) {
        const bp = screenKey(screen, doc) ?? fail(`Unknown screen "${screen}". Call get_dashboard to see them.`);
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
        style: params.style ? { ...widget.style, ...withOverride(params.style) } : widget.style,
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
        params.screen === "all"
          ? screensOf(doc).map((s) => s.key)
          : [screenKey(params.screen, doc) ?? fail(`Unknown screen "${params.screen}".`)];
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

    case "listComponents":
      return {
        doc,
        result: COMPONENTS.filter((c) => !params.category || c.category === params.category).map((c) => ({
          componentId: c.id,
          name: c.name,
          description: c.description,
          category: c.category,
          defaultSize: c.size,
          needsData: c.needs.map((n) => n.kind),
          settings: (c.params ?? []).map((p) => ({ key: p.key, label: p.label, kind: p.kind, default: p.default })),
        })),
        summary: null,
      };

    case "addComponent": {
      const panel = findPanel(doc, params.pageId);
      const def = definitionFor(String(params.componentId)) ?? fail(`No component "${params.componentId}". Call list_components.`);
      const base = params.layout ?? {};
      const { sources, slots } = fillSlots(doc.sources, def.needs);
      // An explicit dataSources map wins over the automatic one.
      for (const [key, id] of Object.entries((params.dataSources ?? {}) as Record<string, string>)) {
        if (!sources.some((s) => s.id === id)) fail(`No data source with id "${id}".`);
        slots[key] = id;
      }
      const z = Math.max(0, ...panel.widgets.map((w) => w.z)) + 1;
      const w = base.w ?? def.size.w;
      const h = base.h ?? def.size.h;
      let widget = createComponentWidget(
        { defId: def.id, sources: slots, params: { ...(params.settings ?? {}) } },
        { name: params.title ?? def.name, w, h },
        base.x ?? 40,
        base.y ?? 40,
        z,
      );
      widget = {
        ...widget,
        ...defined({ showTitle: params.showTitle, locked: params.locked }),
        style: { ...widget.style, ...(withOverride(params.style) ?? {}) },
      };
      for (const [screen, rect] of Object.entries((params.layouts ?? {}) as Record<string, Partial<Rect>>)) {
        const bp = screenKey(screen, doc) ?? fail(`Unknown screen "${screen}". Call get_dashboard to see them.`);
        widget.layouts[bp] = { ...widget.layouts[bp], ...rect };
      }
      return {
        doc: { ...replacePanel(doc, { ...panel, widgets: [...panel.widgets, widget] }), sources },
        result: friendlyWidget(widget),
        summary: `Added component “${widget.title}”`,
      };
    }

    case "listDataSources":
      return {
        doc,
        result: {
          configured: doc.sources.map((s) => {
            const state = liveData().states[s.id];
            return {
              id: s.id,
              kind: s.kind,
              name: s.name,
              settings: s.params,
              status: state?.status ?? "loading",
              error: state?.error ?? null,
            };
          }),
          available: SOURCE_KINDS.map((k) => ({
            kind: k.kind,
            label: k.label,
            description: k.description,
            settings: k.params.map((p) => ({ key: p.key, label: p.label, kind: p.kind, default: p.default, options: p.options })),
          })),
        },
        summary: null,
      };

    case "addDataSource": {
      const kind = sourceKind(String(params.kind)) ?? fail(`Unknown data kind "${params.kind}". Call list_data_sources.`);
      const source: DataSource = {
        id: uid(),
        kind: kind.kind,
        name: params.name ?? kind.label,
        params: { ...defaultParams(kind), ...(params.settings ?? {}) },
      };
      return {
        doc: { ...doc, sources: [...doc.sources, source] },
        result: { dataSourceId: source.id, kind: source.kind, settings: source.params },
        summary: `Added ${kind.label} data`,
      };
    }

    case "updateDataSource": {
      const source = findSource(doc, String(params.dataSourceId));
      const updated: DataSource = {
        ...source,
        ...defined({ name: params.name }),
        params: params.settings ? { ...source.params, ...params.settings } : source.params,
      };
      return {
        doc: { ...doc, sources: doc.sources.map((s) => (s.id === source.id ? updated : s)) },
        result: { dataSourceId: updated.id, settings: updated.params },
        summary: `Updated “${updated.name}” data`,
      };
    }

    case "deleteDataSource": {
      const source = findSource(doc, String(params.dataSourceId));
      const used = doc.panels.flatMap((p) => p.widgets).filter((w) => Object.values(w.component?.sources ?? {}).includes(source.id));
      if (used.length && !params.force)
        fail(`“${source.name}” is used by ${used.length} component(s): ${used.map((w) => w.title).join(", ")}. Pass force: true to remove it anyway.`);
      return {
        doc: { ...doc, sources: doc.sources.filter((s) => s.id !== source.id) },
        result: { deleted: source.id },
        summary: `Removed “${source.name}” data`,
      };
    }

    case "listVariables": {
      const live = liveData();
      return {
        doc,
        result: doc.sources
          .filter((s) => !params.dataSourceId || s.id === params.dataSourceId)
          .map((s) => {
            const kind = sourceKind(s.kind);
            const state = live.states[s.id];
            return {
              dataSourceId: s.id,
              name: s.name,
              kind: s.kind,
              status: state?.status ?? "loading",
              variables: (kind?.fields ?? []).map((f) => {
                const raw = state?.value?.[f.key];
                return {
                  path: f.key,
                  label: f.label,
                  type: f.type,
                  ...(f.type === "list"
                    ? { itemPaths: (f.of ?? []).map((i) => i.key), count: Array.isArray(raw) ? raw.length : 0 }
                    : { value: state?.value ? formatValue(raw, f.type, f.format) : null }),
                };
              }),
            };
          }),
        summary: null,
      };
    }

    case "listThemes":
      return {
        doc,
        result: THEMES.map((t) => ({ themeId: t.id, name: t.name, description: t.description, accent: t.accent, font: t.fontFamily })),
        summary: null,
      };

    case "applyTheme": {
      const panel = findPanel(doc, params.pageId);
      const theme = themeById(String(params.themeId)) ?? fail(`No theme "${params.themeId}". Call list_themes.`);
      const restyle = params.restyleComponents !== false;
      const updated: Panel = {
        ...panel,
        accent: theme.accent,
        fontFamily: theme.fontFamily,
        background: { ...theme.background },
        widgets: restyle ? panel.widgets.map((w) => ({ ...w, style: { ...w.style, ...theme.card } })) : panel.widgets,
      };
      return {
        doc: replacePanel(doc, updated),
        result: { pageId: panel.id, theme: theme.id },
        summary: `Applied the ${theme.name} theme to “${panel.name}”`,
      };
    }

    case "listTemplates":
      return {
        doc,
        result: TEMPLATES.map((t) => ({
          templateId: t.id,
          name: t.name,
          description: t.description,
          contains: templateContents(t),
        })),
        summary: null,
      };

    case "applyTemplate": {
      const template = templateById(String(params.templateId)) ?? fail(`No template "${params.templateId}". Call list_templates.`);
      const { panel, sources } = buildTemplate(template, doc.sources, params.name);
      const next = {
        ...doc,
        sources,
        panels: [...doc.panels, panel],
        activePanelId: params.show === false ? doc.activePanelId : panel.id,
      };
      return {
        doc: next,
        result: {
          pageId: panel.id,
          name: panel.name,
          widgets: panel.widgets.map((w) => ({ id: w.id, type: w.type, title: w.title })),
        },
        summary: `Added page “${panel.name}” from the ${template.name} template`,
      };
    }

    case "checkDashboard":
      return { doc, result: checkDashboard(doc, params), summary: null };

    case "replaceDashboard": {
      if (!params.document || typeof params.document !== "object") fail("document must be a dashboard backup object.");
      const next = normalizeDoc(params.document);
      return { doc: next, result: friendlyDoc(next), summary: "Replaced the whole dashboard" };
    }

    default:
      return fail(`Unknown method "${method}".`);
  }
}
