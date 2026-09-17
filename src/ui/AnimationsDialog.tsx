import { useEffect, useRef, useState } from "react";
import { ALL_WIDGETS, TRIGGER_WIDGET, defaultTiming, runAnimation } from "../animations/engine";
import { PRESETS, PRESET_GROUPS, presetByKey } from "../animations/presets";
import { PROPERTIES, propertyByKey } from "../animations/properties";
import { uid } from "../lib/board";
import type {
  AnimationEffect,
  AnimationPart,
  AnimationRule,
  AnimationTrigger,
  Automation,
  Panel,
  Timing,
  Widget,
} from "../lib/types";
import { Icon, type IconName } from "./icons";
import { Button, ColorField, Dialog, Disclosure, Field, Help, Intro, Section, Segmented, Slider, Toggle, inputClass } from "./kit";

type TriggerKind = AnimationTrigger["kind"];

const TRIGGERS: { kind: TriggerKind; label: string; description: string; icon: IconName }[] = [
  { kind: "pageShown", label: "Page opens", description: "Plays once when this page appears.", icon: "eye" },
  { kind: "click", label: "Tapped", description: "When someone taps or clicks a component.", icon: "pointer" },
  { kind: "hover", label: "Pointer over", description: "When the mouse moves onto a component.", icon: "pointer" },
  { kind: "loop", label: "All the time", description: "Starts right away and never stops.", icon: "repeat" },
  { kind: "every", label: "Every few seconds", description: "Plays again and again on a timer.", icon: "timer" },
  { kind: "timeOfDay", label: "At a set time", description: "Plays at a time of day, like 9:00.", icon: "clock" },
  { kind: "dataChange", label: "Live value changes", description: "When a live number or headline updates.", icon: "activity" },
  { kind: "automation", label: "Automation starts", description: "When one of your automation rules switches on.", icon: "zap" },
];

const EASINGS = [
  { value: "ease-in-out", label: "Smooth" },
  { value: "linear", label: "Steady, same speed throughout" },
  { value: "ease-out", label: "Fast start, gentle stop" },
  { value: "ease-in", label: "Gentle start, fast finish" },
  { value: "cubic-bezier(.34,1.56,.64,1)", label: "Overshoot a little" },
  { value: "cubic-bezier(.68,-0.6,.32,1.6)", label: "Springy" },
  { value: "steps(6)", label: "Choppy, like stop-motion" },
];

const PARTS: { value: AnimationPart; label: string; title: string }[] = [
  { value: "whole", label: "Whole thing", title: "The entire component moves" },
  { value: "card", label: "Box", title: "Just the box and its styling" },
  { value: "title", label: "Name", title: "Only the small heading (if shown)" },
  { value: "content", label: "Inside", title: "Only what's inside the box" },
];

const isWidgetTrigger = (t: AnimationTrigger): t is Extract<AnimationTrigger, { widgetId: string }> => "widgetId" in t;

const widgetName = (widgets: Widget[], id: string) => widgets.find((w) => w.id === id)?.title ?? "a missing component";

export function describeRule(rule: AnimationRule, widgets: Widget[]) {
  const t = rule.trigger;
  const when = {
    pageShown: () => "When the page opens",
    loop: () => "All the time",
    click: () => `When “${widgetName(widgets, (t as { widgetId: string }).widgetId)}” is tapped`,
    hover: () => `When pointing at “${widgetName(widgets, (t as { widgetId: string }).widgetId)}”`,
    every: () => `Every ${(t as { seconds: number }).seconds}s`,
    timeOfDay: () => `At ${(t as { at: string }).at}`,
    dataChange: () => `When “${widgetName(widgets, (t as { widgetId: string }).widgetId)}” changes`,
    automation: () => "When an automation starts",
  }[t.kind]();
  const e = rule.effect;
  const how =
    e.kind === "preset"
      ? (presetByKey(e.preset)?.label ?? "Animation")
      : e.kind === "property"
        ? `Change ${propertyByKey(e.property)?.label.toLowerCase() ?? "setting"}`
        : "Custom code";
  const what =
    rule.target.widgetId === ALL_WIDGETS
      ? "everything"
      : rule.target.widgetId === TRIGGER_WIDGET
        ? "itself"
        : `“${widgetName(widgets, rule.target.widgetId)}”`;
  return `${when} → ${how} ${what}`;
}

const EXAMPLE_CODE = {
  html: `<span class="spark" style="--x:-50px;--y:-40px"></span>
<span class="spark" style="--x:55px;--y:-35px"></span>
<span class="spark" style="--x:-40px;--y:45px"></span>
<span class="spark" style="--x:50px;--y:50px"></span>`,
  css: `.target {
  animation: pop var(--dx-duration) var(--dx-easing);
}

.overlay .spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--dx-accent);
  animation: burst var(--dx-duration) ease-out forwards;
}

@keyframes pop {
  50% { scale: 1.06; }
}

@keyframes burst {
  from { translate: -50% -50%; scale: 1; opacity: 1; }
  to { translate: calc(-50% + var(--x) * 2) calc(-50% + var(--y) * 2); scale: 0; opacity: 0; }
}`,
  js: `// el: the thing being animated. overlay: your HTML layer (or null).
// api.done() ends early; api.animate(keyframes, options) runs a Web Animation on el.
el.style.filter = "saturate(1.8)";
return () => {
  el.style.filter = "";
};`,
};

export function newAnimationRule(widgets: Widget[], widgetId?: string): AnimationRule {
  const target = widgetId ?? widgets[0]?.id ?? ALL_WIDGETS;
  return {
    id: uid(),
    name: "New animation",
    enabled: true,
    trigger: widgetId ? { kind: "click", widgetId } : { kind: "pageShown" },
    target: { widgetId: widgetId ? TRIGGER_WIDGET : target, part: "whole" },
    effect: { kind: "preset", preset: "pulse" },
    timing: defaultTiming(),
  };
}

type Props = {
  panel: Panel;
  automations: Automation[];
  accent: string;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  setAnimations: (rules: AnimationRule[]) => void;
  onClose: () => void;
  initialEditId?: string | null;
};

export function AnimationsDialog({ panel, automations, accent, canvasRef, setAnimations, onClose, initialEditId }: Props) {
  const rules = panel.animations;
  const widgets = panel.widgets;
  const [editingId, setEditingId] = useState<string | null>(initialEditId ?? null);
  const [peeking, setPeeking] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const stopPreview = useRef<(() => void) | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(peekTimer.current);
      stopPreview.current?.();
    },
    [],
  );

  const editing = rules.find((r) => r.id === editingId) ?? null;
  const update = (id: string, patch: Partial<AnimationRule>) =>
    setAnimations(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const preview = (rule: AnimationRule) => {
    const root = canvasRef.current;
    if (!root) return;
    stopPreview.current?.();
    clearTimeout(peekTimer.current);
    setPreviewError(null);
    const sourceWidgetId = isWidgetTrigger(rule.trigger) ? rule.trigger.widgetId : undefined;
    const forever = rule.trigger.kind === "loop" || rule.timing.repeat === 0;
    const length = forever ? 4000 : rule.timing.delay + rule.timing.duration * Math.max(1, rule.timing.repeat);
    setPeeking(true);
    // Wait for the dialog to fade before playing so the animation is visible.
    peekTimer.current = setTimeout(() => {
      stopPreview.current = runAnimation(rule, {
        root,
        accent,
        widgetIds: widgets.map((w) => w.id),
        sourceWidgetId,
        onError: setPreviewError,
      });
      peekTimer.current = setTimeout(
        () => {
          if (forever || !rule.timing.keepEnd) {
            stopPreview.current?.();
            stopPreview.current = null;
          }
          setPeeking(false);
        },
        Math.min(length, 6000) + 500,
      );
    }, 320);
  };

  const cancelPeek = () => {
    clearTimeout(peekTimer.current);
    stopPreview.current?.();
    stopPreview.current = null;
    setPeeking(false);
  };

  const addRule = (rule: AnimationRule) => {
    setAnimations([...rules, rule]);
    setEditingId(rule.id);
  };

  const firstLive = widgets.find((w) => w.type === "api" || w.type === "feed");
  const templates: { label: string; icon: IconName; make: () => AnimationRule }[] = widgets.length
    ? [
        {
          label: "Everything pops in when the page opens",
          icon: "eye",
          make: () => ({
            ...newAnimationRule(widgets),
            name: "Pop in on open",
            trigger: { kind: "pageShown" },
            target: { widgetId: ALL_WIDGETS, part: "whole" },
            effect: { kind: "preset", preset: "popIn" },
            timing: { ...defaultTiming(), duration: 700, easing: "cubic-bezier(.34,1.56,.64,1)" },
          }),
        },
        {
          label: `“${widgets[0].title}” wiggles when tapped`,
          icon: "pointer",
          make: () => ({
            ...newAnimationRule(widgets, widgets[0].id),
            name: "Wiggle on tap",
            effect: { kind: "preset", preset: "wiggle" },
            timing: { ...defaultTiming(), duration: 700 },
          }),
        },
        {
          label: `“${widgets[0].title}” pulses every 10 seconds`,
          icon: "timer",
          make: () => ({
            ...newAnimationRule(widgets),
            name: "Regular pulse",
            trigger: { kind: "every", seconds: 10 },
            target: { widgetId: widgets[0].id, part: "whole" },
          }),
        },
        ...(firstLive
          ? [
              {
                label: `“${firstLive.title}” glows when it updates`,
                icon: "activity" as IconName,
                make: () => ({
                  ...newAnimationRule(widgets),
                  name: "Glow on update",
                  trigger: { kind: "dataChange" as const, widgetId: firstLive.id },
                  target: { widgetId: TRIGGER_WIDGET, part: "card" as AnimationPart },
                  effect: { kind: "preset" as const, preset: "glow" },
                  timing: { ...defaultTiming(), duration: 1200 },
                }),
              },
            ]
          : []),
        {
          label: `Sparkle burst on “${widgets[0].title}” (custom code example)`,
          icon: "code",
          make: () => ({
            ...newAnimationRule(widgets, widgets[0].id),
            name: "Sparkle burst",
            effect: { kind: "custom", ...EXAMPLE_CODE },
            timing: { ...defaultTiming(), duration: 900 },
          }),
        },
      ]
    : [];

  if (editing) {
    return (
      <Dialog
        hidden={peeking}
        onClose={onClose}
        width={520}
        header={
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Button variant="ghost" icon="left" title="All animations" className="-ml-1 px-2" onClick={() => setEditingId(null)} />
            <label className="flex min-w-0 flex-1 items-center gap-1.5">
              <input
                className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none"
                value={editing.name}
                aria-label="Animation name"
                onChange={(e) => update(editing.id, { name: e.target.value })}
              />
              <Icon name="pencil" size={12} className="shrink-0 opacity-40" />
            </label>
          </div>
        }
        footer={
          <>
            <Button icon="play" className="flex-1" onClick={() => preview(editing)}>
              Preview
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setEditingId(null)}>
              Done
            </Button>
          </>
        }
      >
        {previewError ? (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 p-2.5 text-[12.5px] text-red-200">
            Your code hit a problem: {previewError}
          </div>
        ) : null}
        <RuleEditor
          rule={editing}
          widgets={widgets}
          automations={automations}
          accent={accent}
          onChange={(patch) => update(editing.id, patch)}
        />
        {peeking ? <PeekCatcher onCancel={cancelPeek} /> : null}
      </Dialog>
    );
  }

  return (
    <Dialog
      hidden={peeking}
      title="Animations"
      subtitle={`Make things on “${panel.name}” move when something happens.`}
      icon="sparkles"
      onClose={onClose}
      width={520}
      footer={
        <Button
          variant="primary"
          icon="plus"
          className="flex-1"
          disabled={!widgets.length}
          onClick={() => addRule(newAnimationRule(widgets))}
        >
          New animation
        </Button>
      }
    >
      <Intro>
        Every animation has three parts: <b>when</b> it plays (like when something is tapped), <b>what</b> moves, and <b>how</b> it moves.
        Animations play on your finished dashboard — press <b>Preview</b> to try one while editing.
      </Intro>

      {!widgets.length ? (
        <p className="rounded-xl border border-dashed border-white/15 p-4 text-center text-[13px] text-white/50">
          Add something to this page first, then come back to animate it.
        </p>
      ) : null}

      {rules.map((rule) => (
        <div key={rule.id} className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 p-2.5">
          <Toggle checked={rule.enabled} onChange={(enabled) => update(rule.id, { enabled })} label={`Turn ${rule.name} on or off`} />
          <button className="min-w-0 flex-1 text-left" onClick={() => setEditingId(rule.id)}>
            <span className="block truncate text-[13px] font-medium">{rule.name}</span>
            <span className="block truncate text-[12px] text-white/50">{describeRule(rule, widgets)}</span>
          </button>
          <Button variant="ghost" icon="play" title="Preview" className="px-2" onClick={() => preview(rule)} />
          <Button variant="ghost" icon="pencil" title="Edit" className="px-2" onClick={() => setEditingId(rule.id)} />
          <Button
            variant="ghost"
            icon="trash"
            title="Delete"
            className="px-2 hover:text-red-300"
            onClick={() => confirm(`Delete “${rule.name}”?`) && setAnimations(rules.filter((r) => r.id !== rule.id))}
          />
        </div>
      ))}

      {templates.length ? (
        <Section title={rules.length ? "More ideas" : "Try one of these to start"}>
          {templates.map((t) => (
            <button
              key={t.label}
              onClick={() => addRule(t.make())}
              className="mb-1.5 flex w-full items-center gap-2.5 rounded-xl border border-dashed border-white/15 p-2.5 text-left text-[13px] transition hover:border-[var(--accent)]/60 hover:bg-white/[0.05]"
            >
              <Icon name={t.icon} className="shrink-0 text-[var(--accent)]" />
              {t.label}
            </button>
          ))}
        </Section>
      ) : null}
      {peeking ? <PeekCatcher onCancel={cancelPeek} /> : null}
    </Dialog>
  );
}

function PeekCatcher({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-[60] flex justify-center">
      <button
        onClick={onCancel}
        className="pointer-events-auto rounded-full bg-black/70 px-4 py-2 text-[12.5px] text-white shadow-lg backdrop-blur"
      >
        Previewing… tap to stop
      </button>
    </div>
  );
}

function StepHeading({ n, title, help }: { n: number; title: string; help?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-[var(--accent-ink)]">
        {n}
      </span>
      <h3 className="text-[14px] font-semibold">{title}</h3>
      {help ? <Help>{help}</Help> : null}
    </div>
  );
}

function RuleEditor({
  rule,
  widgets,
  automations,
  accent,
  onChange,
}: {
  rule: AnimationRule;
  widgets: Widget[];
  automations: Automation[];
  accent: string;
  onChange: (patch: Partial<AnimationRule>) => void;
}) {
  const t = rule.trigger;
  const liveWidgets = widgets.filter((w) => w.type === "api" || w.type === "feed");

  const setTriggerKind = (kind: TriggerKind) => {
    const fallbackWidget =
      (isWidgetTrigger(t) && t.widgetId) ||
      (rule.target.widgetId.startsWith("@") ? widgets[0]?.id : rule.target.widgetId) ||
      "";
    let trigger: AnimationTrigger;
    switch (kind) {
      case "click":
      case "hover":
        trigger = { kind, widgetId: fallbackWidget };
        break;
      case "dataChange":
        trigger = { kind, widgetId: liveWidgets.some((w) => w.id === fallbackWidget) ? fallbackWidget : (liveWidgets[0]?.id ?? "") };
        break;
      case "every":
        trigger = { kind, seconds: 10 };
        break;
      case "timeOfDay":
        trigger = { kind, at: "09:00" };
        break;
      case "automation":
        trigger = { kind, automationId: automations[0]?.id ?? "" };
        break;
      default:
        trigger = { kind };
    }
    const target =
      rule.target.widgetId === TRIGGER_WIDGET && !("widgetId" in trigger)
        ? { ...rule.target, widgetId: isWidgetTrigger(t) ? t.widgetId : (widgets[0]?.id ?? ALL_WIDGETS) }
        : rule.target;
    onChange({ trigger, target });
  };

  const setEffectKind = (kind: AnimationEffect["kind"]) => {
    if (kind === rule.effect.kind) return;
    if (kind === "preset") onChange({ effect: { kind, preset: "pulse" } });
    if (kind === "property") {
      const p = PROPERTIES[1];
      onChange({ effect: { kind, property: p.key, ...p.defaults } });
    }
    if (kind === "custom") onChange({ effect: { kind, html: "", css: ".target {\n  \n}", js: "" } });
  };

  const setTiming = (patch: Partial<Timing>) => onChange({ timing: { ...rule.timing, ...patch } });
  const widgetOptions = widgets.map((w) => (
    <option key={w.id} value={w.id}>
      {w.title}
    </option>
  ));

  return (
    <>
      <section className="mb-6">
        <StepHeading n={1} title="When should it play?" />
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {TRIGGERS.map((opt) => (
            <button
              key={opt.kind}
              onClick={() => setTriggerKind(opt.kind)}
              className={`flex items-start gap-2 rounded-xl border p-2 text-left transition ${t.kind === opt.kind ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10 hover:bg-white/[0.06]"}`}
            >
              <Icon name={opt.icon} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium">{opt.label}</span>
                <span className="block text-[11.5px] leading-snug text-white/45">{opt.description}</span>
              </span>
            </button>
          ))}
        </div>

        {t.kind === "click" || t.kind === "hover" ? (
          <Field label={t.kind === "click" ? "Which component gets tapped?" : "Which component gets pointed at?"} stacked>
            <select className={inputClass} value={t.widgetId} onChange={(e) => onChange({ trigger: { ...t, widgetId: e.target.value } })}>
              <option value="">Pick one…</option>
              {widgetOptions}
            </select>
          </Field>
        ) : null}
        {t.kind === "dataChange" ? (
          liveWidgets.length ? (
            <Field label="Which live component?" help="Only “Live number” and “News headlines” components update by themselves." stacked>
              <select className={inputClass} value={t.widgetId} onChange={(e) => onChange({ trigger: { ...t, widgetId: e.target.value } })}>
                {liveWidgets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="text-[12.5px] text-amber-200/80">Add a “Live number” or “News headlines” component to this page to use this.</p>
          )
        ) : null}
        {t.kind === "every" ? (
          <Field label="How often">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                className={`${inputClass} w-20`}
                value={t.seconds}
                onChange={(e) => onChange({ trigger: { ...t, seconds: Math.max(1, Number(e.target.value)) } })}
              />
              <span className="text-[13px] text-white/60">seconds</span>
            </div>
          </Field>
        ) : null}
        {t.kind === "timeOfDay" ? (
          <Field label="Time" help="Plays once when this time arrives, every day, as long as the dashboard is open.">
            <input type="time" className={`${inputClass} w-32`} value={t.at} onChange={(e) => onChange({ trigger: { ...t, at: e.target.value } })} />
          </Field>
        ) : null}
        {t.kind === "automation" ? (
          automations.length ? (
            <Field label="Which automation?" help="Plays the moment that rule's conditions become true (for example when 10pm arrives)." stacked>
              <select className={inputClass} value={t.automationId} onChange={(e) => onChange({ trigger: { ...t, automationId: e.target.value } })}>
                {automations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="text-[12.5px] text-amber-200/80">You don't have any automations yet. Make one in Automations first.</p>
          )
        ) : null}
      </section>

      <section className="mb-6">
        <StepHeading n={2} title="What should move?" />
        <Field label="Component" stacked>
          <select
            className={inputClass}
            value={rule.target.widgetId}
            onChange={(e) => onChange({ target: { ...rule.target, widgetId: e.target.value } })}
          >
            {isWidgetTrigger(t) ? <option value={TRIGGER_WIDGET}>The same one that triggered it</option> : null}
            <option value={ALL_WIDGETS}>Every component on this page</option>
            {widgetOptions}
          </select>
        </Field>
        <Field
          label="Which part"
          help="“Whole thing” moves everything. “Box” changes only the box styling (great for colour and glow). “Name” and “Inside” animate just the heading or the content."
          stacked
        >
          <Segmented
            size="sm"
            value={rule.target.part}
            onChange={(part) => onChange({ target: { ...rule.target, part } })}
            options={PARTS}
          />
        </Field>
      </section>

      <section className="mb-6">
        <StepHeading n={3} title="How should it move?" />
        <div className="mb-3">
          <Segmented
            value={rule.effect.kind}
            onChange={setEffectKind}
            options={[
              { value: "preset", label: "Ready-made" },
              { value: "property", label: "Change a setting" },
              { value: "custom", label: "Write code" },
            ]}
          />
        </div>
        {rule.effect.kind === "preset" ? (
          <PresetPicker
            value={rule.effect.preset}
            accent={accent}
            onPick={(key) => {
              const preset = presetByKey(key);
              onChange({
                effect: { kind: "preset", preset: key },
                timing: { ...defaultTiming(), ...preset?.timing, delay: rule.timing.delay },
              });
            }}
          />
        ) : null}
        {rule.effect.kind === "property" ? (
          <PropertyEditor effect={rule.effect} onChange={(effect) => onChange({ effect })} />
        ) : null}
        {rule.effect.kind === "custom" ? (
          <CodeEditor effect={rule.effect} onChange={(effect) => onChange({ effect })} />
        ) : null}
      </section>

      <section>
        <StepHeading n={4} title="Timing" />
        <Field label="How long">
          <Slider value={rule.timing.duration} min={100} max={10000} step={100} onChange={(duration) => setTiming({ duration })} format={(v) => `${(v / 1000).toFixed(1)}s`} />
        </Field>
        <Field label="Wait before starting">
          <Slider value={rule.timing.delay} min={0} max={5000} step={100} onChange={(delay) => setTiming({ delay })} format={(v) => `${(v / 1000).toFixed(1)}s`} />
        </Field>
        <Field label="Movement style" help="Changes the feel: smooth, bouncy, robotic… Try Preview to compare." stacked>
          <select className={inputClass} value={rule.timing.easing} onChange={(e) => setTiming({ easing: e.target.value })}>
            {EASINGS.some((o) => o.value === rule.timing.easing) ? null : <option value={rule.timing.easing}>{rule.timing.easing}</option>}
            {EASINGS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {t.kind === "loop" ? (
          <p className="mb-3 text-[12px] text-white/45">“All the time” animations repeat forever.</p>
        ) : (
          <Field label="Play" stacked>
            <Segmented
              size="sm"
              value={String(rule.timing.repeat)}
              onChange={(v) => setTiming({ repeat: Number(v) })}
              options={[
                { value: "1", label: "Once" },
                { value: "2", label: "Twice" },
                { value: "3", label: "3 times" },
                { value: "0", label: "Forever" },
              ]}
            />
          </Field>
        )}
        <Field label="Back and forth" help="Plays forwards, then backwards, like a yo-yo. Needs more than one play to notice.">
          <Toggle checked={rule.timing.alternate} onChange={(alternate) => setTiming({ alternate })} label="Back and forth" />
        </Field>
        <Field label="Stay at the end" help="Keeps the final look when finished instead of snapping back. Useful for fading something out.">
          <Toggle checked={rule.timing.keepEnd} onChange={(keepEnd) => setTiming({ keepEnd })} label="Stay at the end" />
        </Field>
      </section>
    </>
  );
}

function PresetPicker({ value, accent, onPick }: { value: string; accent: string; onPick: (key: string) => void }) {
  const play = (el: HTMLElement | null, key: string) => {
    const preset = presetByKey(key);
    if (!el || !preset) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(preset.keyframes({ accent }), {
      duration: Math.min(preset.timing?.duration ?? 800, 1600),
      easing: preset.timing?.easing ?? "ease-in-out",
    });
  };
  return (
    <>
      <p className="mb-2 text-[12px] text-white/45">Point at (or tap) one to see it move.</p>
      {PRESET_GROUPS.map((group) => (
        <div key={group} className="mb-3">
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-white/40 uppercase">{group}</h4>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {PRESETS.filter((p) => p.group === group).map((p) => (
              <button
                key={p.key}
                title={p.description}
                onMouseEnter={(e) => play(e.currentTarget.querySelector("[data-demo]"), p.key)}
                onClick={(e) => {
                  onPick(p.key);
                  play(e.currentTarget.querySelector("[data-demo]"), p.key);
                }}
                className={`flex items-center gap-2 rounded-xl border p-2 text-left text-[12.5px] transition ${value === p.key ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10 hover:bg-white/[0.06]"}`}
              >
                <span data-demo className="h-5 w-5 shrink-0 rounded-md bg-[var(--accent)]" />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-[12px] text-white/50">{presetByKey(value)?.description}</p>
    </>
  );
}

function PropertyEditor({
  effect,
  onChange,
}: {
  effect: Extract<AnimationEffect, { kind: "property" }>;
  onChange: (e: AnimationEffect) => void;
}) {
  const prop = propertyByKey(effect.property) ?? PROPERTIES[0];
  const fromCurrent = effect.from.trim() === "";
  const input = (value: string, set: (v: string) => void) =>
    prop.input === "color" ? (
      <ColorField value={value || "#ffffff"} onChange={set} />
    ) : (
      <div className="flex items-center gap-1.5">
        <input type="number" step={prop.step ?? 1} className={`${inputClass} w-24`} value={value} onChange={(e) => set(e.target.value)} />
        {prop.unit ? <span className="text-[13px] text-white/50">{prop.unit}</span> : null}
      </div>
    );

  return (
    <>
      <Field label="Setting to change" stacked>
        <select
          className={inputClass}
          value={prop.key}
          onChange={(e) => {
            const next = propertyByKey(e.target.value)!;
            onChange({ kind: "property", property: next.key, ...next.defaults });
          }}
        >
          {PROPERTIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <p className="-mt-2 mb-3 text-[12px] text-white/45">{prop.hint}</p>
      <Field label="Start from how it looks now" help="Turn off to choose an exact starting value.">
        <Toggle
          checked={fromCurrent}
          onChange={(on) => onChange({ ...effect, from: on ? "" : prop.defaults.from || (prop.input === "color" ? "#ffffff" : "0") })}
          label="Start from how it looks now"
        />
      </Field>
      {!fromCurrent ? <Field label="Start at">{input(effect.from, (from) => onChange({ ...effect, from }))}</Field> : null}
      <Field label="Change to">{input(effect.to, (to) => onChange({ ...effect, to }))}</Field>
    </>
  );
}

function CodeEditor({
  effect,
  onChange,
}: {
  effect: Extract<AnimationEffect, { kind: "custom" }>;
  onChange: (e: AnimationEffect) => void;
}) {
  const area = (key: "html" | "css" | "js", label: string, help: string, rows: number) => (
    <Field label={label} help={help} stacked>
      <textarea
        spellCheck={false}
        className={`${inputClass} font-['JetBrains_Mono'] text-[12px] leading-relaxed`}
        style={{ height: rows * 20 + 16 }}
        value={effect[key]}
        onChange={(e) => onChange({ ...effect, [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] text-white/45">For people who know a bit of web code. All three boxes are optional.</p>
        <Button
          className="shrink-0 py-1.5 text-[12px]"
          onClick={() =>
            (!(effect.html + effect.js).trim() && effect.css.replace(/\s|\.target|\{|\}/g, "") === "") ||
            confirm("Replace your code with the example?")
              ? onChange({ kind: "custom", ...EXAMPLE_CODE })
              : undefined
          }
        >
          Load example
        </Button>
      </div>
      <Disclosure title="How custom code works">
        <ul className="mb-3 list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-white/65">
          <li>
            In <b>CSS</b>, write <code>.target</code> to style the thing being animated, and <code>.overlay</code> for your HTML layer. They
            only apply while the animation plays.
          </li>
          <li>
            Use the Timing settings in your CSS: <code>var(--dx-duration)</code>, <code>var(--dx-delay)</code>, <code>var(--dx-easing)</code>,{" "}
            <code>var(--dx-repeat)</code>, <code>var(--dx-direction)</code>, <code>var(--dx-fill)</code> and your highlight colour{" "}
            <code>var(--dx-accent)</code>.
          </li>
          <li>
            <b>HTML</b> is placed in a layer on top of the component while the animation plays — perfect for sparkles, confetti or
            badges.
          </li>
          <li>
            <b>JavaScript</b> runs when it's triggered with <code>el</code> (the target), <code>overlay</code> (your HTML layer) and{" "}
            <code>api</code>: <code>api.done()</code>, <code>api.animate(keyframes, options)</code>, <code>api.wait(ms)</code>,{" "}
            <code>api.accent</code>, <code>api.duration</code>. Return a function to clean up afterwards.
          </li>
          <li>The animation ends after its Timing length (unless it repeats forever), or when you call api.done().</li>
        </ul>
      </Disclosure>
      {area("css", "CSS", "Styles and @keyframes. Use .target and .overlay as described above.", 9)}
      {area("html", "HTML (optional)", "Extra elements shown on top of the component while it plays.", 4)}
      {area("js", "JavaScript (optional)", "Runs each time the animation is triggered. Unlike Custom code components, this runs directly on your dashboard — only paste code you trust.", 6)}
    </>
  );
}
