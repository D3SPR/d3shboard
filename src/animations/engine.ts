import { useEffect, useRef } from "react";
import type { AnimationRule, Panel, Timing } from "../lib/types";
import { WIDGET_DATA_EVENT } from "../lib/util";
import { presetByKey } from "./presets";
import { propertyByKey } from "./properties";

export const TRIGGER_WIDGET = "@trigger";
export const ALL_WIDGETS = "@all";

export const defaultTiming = (): Timing => ({
  duration: 800,
  delay: 0,
  easing: "ease-in-out",
  repeat: 1,
  alternate: false,
  keepEnd: false,
});

export type RunOptions = {
  root: HTMLElement;
  accent: string;
  widgetIds: string[];
  sourceWidgetId?: string;
  forceForever?: boolean;
  onError?: (message: string) => void;
};

const PART_SELECTOR: Record<string, string> = {
  card: "[data-widget-card]",
  title: "[data-widget-title]",
  content: "[data-widget-content]",
};

const findWrapper = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(id)}"]`);

function resolveTargets(rule: AnimationRule, opts: RunOptions) {
  const { widgetId } = rule.target;
  const ids =
    widgetId === ALL_WIDGETS
      ? opts.widgetIds
      : widgetId === TRIGGER_WIDGET
        ? opts.sourceWidgetId
          ? [opts.sourceWidgetId]
          : []
        : [widgetId];

  let part = rule.target.part;
  if (rule.effect.kind === "preset" && part === "whole" && presetByKey(rule.effect.preset)?.usesCard) part = "card";
  if (rule.effect.kind === "property" && part === "whole") part = propertyByKey(rule.effect.property)?.element ?? part;

  return ids.flatMap((id) => {
    const wrapper = findWrapper(opts.root, id);
    if (!wrapper) return [];
    const el = part === "whole" ? wrapper : wrapper.querySelector<HTMLElement>(PART_SELECTOR[part]);
    return el ? [{ wrapper, el }] : [];
  });
}

const totalMs = (t: Timing, forever: boolean) =>
  forever || t.repeat === 0 ? Infinity : t.delay + t.duration * Math.max(1, t.repeat);

// A running animation per (rule, element), so re-triggering restarts instead of stacking.
const running = new WeakMap<HTMLElement, Map<string, () => void>>();

const track = (el: HTMLElement, ruleId: string, cancel: () => void) => {
  let map = running.get(el);
  if (!map) running.set(el, (map = new Map()));
  map.get(ruleId)?.();
  map.set(ruleId, cancel);
  return () => {
    if (map!.get(ruleId) === cancel) map!.delete(ruleId);
    cancel();
  };
};

export function rewriteCustomCss(ruleId: string, css: string) {
  return css
    .replace(/\.target\b/g, `[data-dx-run~="${ruleId}"]`)
    .replace(/\.overlay\b/g, `[data-dx-overlay="${ruleId}"]`);
}

function ensureStyle(rule: AnimationRule, css: string) {
  const id = `dx-style-${rule.id}`;
  let tag = document.getElementById(id) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = id;
    document.head.appendChild(tag);
  }
  const text = rewriteCustomCss(rule.id, css);
  if (tag.textContent !== text) tag.textContent = text;
}

export function removeUnusedStyles(keepIds: Set<string>) {
  document.querySelectorAll<HTMLStyleElement>('style[id^="dx-style-"]').forEach((tag) => {
    if (!keepIds.has(tag.id.slice("dx-style-".length))) tag.remove();
  });
}

function runCustom(
  rule: AnimationRule & { effect: { kind: "custom" } },
  wrapper: HTMLElement,
  el: HTMLElement,
  timing: Timing,
  forever: boolean,
  opts: RunOptions,
) {
  const { html, css, js } = rule.effect;
  ensureStyle(rule, css);

  const tokens = new Set((el.getAttribute("data-dx-run") ?? "").split(" ").filter(Boolean));
  tokens.delete(rule.id);
  el.setAttribute("data-dx-run", [...tokens].join(" "));
  void el.offsetWidth; // Reflow so CSS animations restart when re-triggered.
  tokens.add(rule.id);
  el.setAttribute("data-dx-run", [...tokens].join(" "));

  const vars: Record<string, string> = {
    "--dx-duration": `${timing.duration}ms`,
    "--dx-delay": `${timing.delay}ms`,
    "--dx-easing": timing.easing,
    "--dx-repeat": forever || timing.repeat === 0 ? "infinite" : String(timing.repeat),
    "--dx-direction": timing.alternate ? "alternate" : "normal",
    "--dx-fill": timing.keepEnd ? "forwards" : "none",
    "--dx-accent": opts.accent,
  };
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));

  let overlay: HTMLDivElement | null = null;
  if (html.trim()) {
    overlay = document.createElement("div");
    overlay.setAttribute("data-dx-overlay", rule.id);
    overlay.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:5;border-radius:inherit;";
    Object.entries(vars).forEach(([k, v]) => overlay!.style.setProperty(k, v));
    overlay.innerHTML = html;
    wrapper.appendChild(overlay);
  }

  const animations: Animation[] = [];
  let userCleanup: unknown;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    animations.forEach((a) => a.cancel());
    if (typeof userCleanup === "function") {
      try {
        userCleanup();
      } catch {
        // User cleanup errors must not break the dashboard.
      }
    }
    overlay?.remove();
    const left = (el.getAttribute("data-dx-run") ?? "").split(" ").filter((t) => t && t !== rule.id);
    if (left.length) el.setAttribute("data-dx-run", left.join(" "));
    else el.removeAttribute("data-dx-run");
    if (!timing.keepEnd) Object.keys(vars).forEach((k) => el.style.removeProperty(k));
  };

  if (js.trim()) {
    const api = {
      done: () => stop(),
      accent: opts.accent,
      duration: timing.duration,
      wait: (ms: number) => new Promise((r) => setTimeout(r, ms)),
      animate: (keyframes: Keyframe[], options?: KeyframeAnimationOptions) => {
        const a = el.animate(keyframes, options);
        animations.push(a);
        return a;
      },
    };
    try {
      userCleanup = new Function("el", "overlay", "api", js)(el, overlay, api);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      opts.onError?.(message);
      console.warn(`[d3shboard] Animation “${rule.name}” code error:`, err);
    }
  }

  const stop = track(el, rule.id, cleanup);
  const ms = totalMs(timing, forever);
  if (Number.isFinite(ms)) timer = setTimeout(stop, ms + 50);
  return stop;
}

export function runAnimation(rule: AnimationRule, opts: RunOptions): () => void {
  const timing = rule.timing;
  const forever = !!opts.forceForever;
  const targets = resolveTargets(rule, opts);
  const stops: (() => void)[] = [];

  for (const { wrapper, el } of targets) {
    const { effect } = rule;
    if (effect.kind === "custom") {
      stops.push(runCustom(rule as AnimationRule & { effect: { kind: "custom" } }, wrapper, el, timing, forever, opts));
      continue;
    }

    let keyframes: Keyframe[] = [];
    if (effect.kind === "preset") {
      const preset = presetByKey(effect.preset);
      if (!preset) continue;
      keyframes = preset.keyframes({ accent: opts.accent });
    } else {
      const prop = propertyByKey(effect.property);
      if (!prop) continue;
      keyframes = effect.from.trim()
        ? [prop.toKeyframe(effect.from), prop.toKeyframe(effect.to)]
        : [prop.toKeyframe(effect.to)];
    }

    try {
      const animation = el.animate(keyframes, {
        duration: Math.max(1, timing.duration),
        delay: Math.max(0, timing.delay),
        easing: timing.easing,
        iterations: forever || timing.repeat === 0 ? Infinity : Math.max(1, timing.repeat),
        direction: timing.alternate ? "alternate" : "normal",
        fill: timing.keepEnd ? "forwards" : "none",
      });
      stops.push(track(el, rule.id, () => animation.cancel()));
    } catch (err) {
      opts.onError?.(err instanceof Error ? err.message : String(err));
    }
  }

  return () => stops.forEach((s) => s());
}

const timeKey = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

type EngineArgs = {
  rootRef: React.RefObject<HTMLElement | null>;
  panel: Panel;
  active: boolean;
  accent: string;
  activeAutomationIds: string[];
};

export function useAnimationEngine({ rootRef, panel, active, accent, activeAutomationIds }: EngineArgs) {
  const rules = panel.animations;
  const visibleKey = panel.widgets.map((w) => w.id).join("|");
  const optsRef = useRef({ accent, widgetIds: panel.widgets.map((w) => w.id) });
  optsRef.current = { accent, widgetIds: panel.widgets.map((w) => w.id) };

  useEffect(() => {
    removeUnusedStyles(
      new Set(rules.filter((r) => r.effect.kind === "custom").map((r) => r.id)),
    );
  }, [rules]);

  useEffect(() => {
    const root = rootRef.current;
    if (!active || !root) return;
    const enabled = rules.filter((r) => r.enabled);
    if (!enabled.length) return;

    const stops = new Set<() => void>();
    const timers: ReturnType<typeof setInterval>[] = [];
    const play = (rule: AnimationRule, sourceWidgetId?: string, forceForever?: boolean) => {
      const stop = runAnimation(rule, { root, ...optsRef.current, sourceWidgetId, forceForever });
      stops.add(stop);
    };

    const widgetIdAt = (target: EventTarget | null) =>
      (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-widget-id]")?.dataset.widgetId;

    const onClick = (e: Event) => {
      const id = widgetIdAt(e.target);
      if (!id) return;
      enabled.forEach((r) => r.trigger.kind === "click" && r.trigger.widgetId === id && play(r, id));
    };
    const onOver = (e: PointerEvent) => {
      const id = widgetIdAt(e.target);
      if (!id || widgetIdAt(e.relatedTarget) === id) return;
      enabled.forEach((r) => r.trigger.kind === "hover" && r.trigger.widgetId === id && play(r, id));
    };
    const onData = (e: Event) => {
      const id = (e as CustomEvent<{ widgetId: string }>).detail.widgetId;
      enabled.forEach((r) => r.trigger.kind === "dataChange" && r.trigger.widgetId === id && play(r, id));
    };

    root.addEventListener("click", onClick);
    root.addEventListener("pointerover", onOver);
    window.addEventListener(WIDGET_DATA_EVENT, onData);

    const firedAt = new Map<string, string>();
    for (const rule of enabled) {
      const t = rule.trigger;
      if (t.kind === "pageShown") play(rule);
      else if (t.kind === "loop") play(rule, undefined, true);
      else if (t.kind === "every") timers.push(setInterval(() => play(rule), Math.max(1, t.seconds) * 1000));
    }
    const timed = enabled.filter((r) => r.trigger.kind === "timeOfDay");
    if (timed.length) {
      timers.push(
        setInterval(() => {
          const now = new Date();
          const key = `${now.toDateString()} ${timeKey(now)}`;
          timed.forEach((rule) => {
            if (rule.trigger.kind === "timeOfDay" && rule.trigger.at === timeKey(now) && firedAt.get(rule.id) !== key) {
              firedAt.set(rule.id, key);
              play(rule);
            }
          });
        }, 1000),
      );
    }

    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("pointerover", onOver);
      window.removeEventListener(WIDGET_DATA_EVENT, onData);
      timers.forEach(clearInterval);
      stops.forEach((s) => s());
    };
  }, [rules, active, panel.id, visibleKey, rootRef]);

  const prevActive = useRef<Set<string> | null>(null);
  const automationKey = activeAutomationIds.join("|");
  useEffect(() => {
    const now = new Set(activeAutomationIds);
    const before = prevActive.current;
    prevActive.current = now;
    const root = rootRef.current;
    if (!active || !root || !before) return;
    rules
      .filter((r) => r.enabled && r.trigger.kind === "automation")
      .forEach((r) => {
        const id = r.trigger.kind === "automation" ? r.trigger.automationId : "";
        if (now.has(id) && !before.has(id)) runAnimation(r, { root, ...optsRef.current });
      });
  }, [automationKey, active]);
}
