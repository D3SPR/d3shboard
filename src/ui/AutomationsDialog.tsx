import { FONTS, defaultBackground, uid } from "../lib/board";
import type { Action, Automation, BoardDoc, Condition, DataOp } from "../lib/types";
import { Icon, type IconName } from "./icons";
import { ACCENT_SWATCHES } from "./Toolbar";
import { Button, ColorField, Dialog, Field, Help, Intro, Section, Toggle, inputClass } from "./kit";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CONDITIONS: { kind: Condition["kind"]; label: string; help: string }[] = [
  { kind: "timeRange", label: "It's between two times", help: "For example 22:00 to 06:00 for night-time. Works across midnight." },
  { kind: "weekday", label: "It's a certain day of the week", help: "Pick one or more days. Tap a day to switch it on or off." },
  { kind: "monthday", label: "It's a certain date in the month", help: "Type day numbers separated by commas, like 1, 15." },
  { kind: "month", label: "It's a certain month", help: "Pick one or more months." },
  {
    kind: "dataValue",
    label: "A value from a data link…",
    help: "Checks a live value from a web address that returns JSON (checked every minute). Use the same kind of link and value path as a “Live number” component.",
  },
];

const ACTIONS: { kind: Action["kind"]; label: string }[] = [
  { kind: "setPanel", label: "Show a page" },
  { kind: "setAccent", label: "Change highlight colour" },
  { kind: "setFont", label: "Change font" },
  { kind: "setBackground", label: "Change background" },
  { kind: "setWidgetVisible", label: "Show or hide a component" },
];

const newCondition = (kind: Condition["kind"]): Condition => {
  switch (kind) {
    case "timeRange":
      return { kind, from: "22:00", to: "06:00" };
    case "weekday":
      return { kind, days: [1, 2, 3, 4, 5] };
    case "monthday":
      return { kind, days: [1] };
    case "month":
      return { kind, months: [1] };
    default:
      return { kind: "dataValue", url: "", path: "", op: "is", value: "" };
  }
};

const newAction = (kind: Action["kind"], doc: BoardDoc): Action => {
  switch (kind) {
    case "setPanel":
      return { kind, panelId: doc.panels[0]?.id ?? "" };
    case "setAccent":
      return { kind, color: ACCENT_SWATCHES[0] };
    case "setFont":
      return { kind, fontFamily: FONTS[0] };
    case "setBackground":
      return { kind, background: defaultBackground() };
    default:
      return { kind: "setWidgetVisible", widgetId: "", visible: false };
  }
};

export const newAutomationRule = (doc: BoardDoc): Automation => ({
  id: uid(),
  name: `Rule ${doc.automations.length + 1}`,
  enabled: true,
  conditions: [newCondition("timeRange")],
  actions: [newAction("setAccent", doc)],
});

function DayPicker({ values, labels, offset, onChange }: { values: number[]; labels: string[]; offset: number; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((label, i) => {
        const v = i + offset;
        const on = values.includes(v);
        return (
          <button
            key={label}
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((x) => x !== v) : [...values, v])}
            className={`rounded-md border px-2 py-1 text-[12px] transition ${on ? "border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--accent-ink)]" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  doc: BoardDoc;
  onClose: () => void;
  setAutomations: (rules: Automation[]) => void;
};

export function AutomationsDialog({ doc, onClose, setAutomations }: Props) {
  const rules = doc.automations;
  const update = (id: string, patch: Partial<Automation>) => setAutomations(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const widgets = doc.panels.flatMap((p) => p.widgets.map((w) => ({ id: w.id, label: `${p.name} · ${w.title}` })));

  const templates: { label: string; icon: IconName; make: () => Automation }[] = [
    {
      label: "Dark, calm theme at night (10pm – 6am)",
      icon: "clock",
      make: () => ({
        id: uid(),
        name: "Night theme",
        enabled: true,
        conditions: [newCondition("timeRange")],
        actions: [
          { kind: "setBackground", background: { ...defaultBackground(), kind: "solid", color: "#050508" } },
          { kind: "setAccent", color: "#ff8fc7" },
        ],
      }),
    },
    {
      label: "Show a different page at the weekend",
      icon: "calendar",
      make: () => ({
        id: uid(),
        name: "Weekend page",
        enabled: true,
        conditions: [{ kind: "weekday", days: [0, 6] }],
        actions: [newAction("setPanel", doc)],
      }),
    },
  ];

  const addRule = (rule: Automation) => setAutomations([...rules, rule]);

  return (
    <Dialog
      title="Automations"
      subtitle="Change your dashboard by itself, depending on the time or live data."
      icon="zap"
      onClose={onClose}
      width={540}
      footer={
        <Button
          variant="primary"
          icon="plus"
          className="flex-1"
          onClick={() => addRule(newAutomationRule(doc))}
        >
          New rule
        </Button>
      }
    >
      <Intro>
        A rule says <b>when</b> something is true (a time, a day, a live value) and <b>then</b> what should change. Rules only take
        effect on your finished dashboard, after you press <b>Done</b>. When a rule stops being true, things go back to normal.
      </Intro>

      {rules.length === 0 ? (
        <Section title="Try one of these to start">
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

      {rules.map((rule) => (
        <div key={rule.id} className="mb-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-3 flex items-center gap-2">
            <Toggle checked={rule.enabled} onChange={(enabled) => update(rule.id, { enabled })} label="Rule on or off" />
            <label className="flex min-w-0 flex-1 items-center gap-1.5">
              <input
                className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none"
                value={rule.name}
                aria-label="Rule name"
                onChange={(e) => update(rule.id, { name: e.target.value })}
              />
              <Icon name="pencil" size={12} className="shrink-0 opacity-40" />
            </label>
            <Button
              variant="ghost"
              icon="trash"
              title="Delete rule"
              className="px-2 hover:text-red-300"
              onClick={() => confirm(`Delete “${rule.name}”?`) && setAutomations(rules.filter((r) => r.id !== rule.id))}
            />
          </div>

          <div className="mb-1.5 text-[12px] font-semibold text-white/55">When all of these are true…</div>
          {rule.conditions.map((cond, i) => {
            const set = (c: Condition) => update(rule.id, { conditions: rule.conditions.map((x, j) => (j === i ? c : x)) });
            const meta = CONDITIONS.find((c) => c.kind === cond.kind)!;
            return (
              <div key={i} className="mb-2 rounded-xl border border-white/10 p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <select className={inputClass} value={cond.kind} onChange={(e) => set(newCondition(e.target.value as Condition["kind"]))}>
                    {CONDITIONS.map((c) => (
                      <option key={c.kind} value={c.kind}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <Help>{meta.help}</Help>
                  <Button
                    variant="ghost"
                    icon="close"
                    title="Remove this condition"
                    className="px-1.5"
                    onClick={() => update(rule.id, { conditions: rule.conditions.filter((_, j) => j !== i) })}
                  />
                </div>
                {cond.kind === "timeRange" ? (
                  <div className="flex items-center gap-2 text-[13px]">
                    <input type="time" className={inputClass} value={cond.from} onChange={(e) => set({ ...cond, from: e.target.value })} />
                    <span className="text-white/50">to</span>
                    <input type="time" className={inputClass} value={cond.to} onChange={(e) => set({ ...cond, to: e.target.value })} />
                  </div>
                ) : null}
                {cond.kind === "weekday" ? <DayPicker values={cond.days} labels={DAYS} offset={0} onChange={(days) => set({ ...cond, days })} /> : null}
                {cond.kind === "month" ? <DayPicker values={cond.months} labels={MONTHS} offset={1} onChange={(months) => set({ ...cond, months })} /> : null}
                {cond.kind === "monthday" ? (
                  <input
                    className={inputClass}
                    placeholder="e.g. 1, 15, 28"
                    value={cond.days.join(", ")}
                    onChange={(e) =>
                      set({
                        ...cond,
                        days: e.target.value
                          .split(",")
                          .map((d) => Number(d.trim()))
                          .filter((d) => d >= 1 && d <= 31),
                      })
                    }
                  />
                ) : null}
                {cond.kind === "dataValue" ? (
                  <div className="grid gap-2">
                    <input className={inputClass} placeholder="Data link, e.g. https://api.example.com/data.json" value={cond.url} onChange={(e) => set({ ...cond, url: e.target.value })} />
                    <input className={inputClass} placeholder="Which value, e.g. weather.temp" value={cond.path} onChange={(e) => set({ ...cond, path: e.target.value })} />
                    <div className="flex gap-2">
                      <select className={inputClass} value={cond.op} onChange={(e) => set({ ...cond, op: e.target.value as DataOp })}>
                        <option value="is">is exactly</option>
                        <option value="isNot">is not</option>
                        <option value="contains">contains</option>
                        <option value="gt">is more than</option>
                        <option value="lt">is less than</option>
                      </select>
                      <input className={inputClass} placeholder="value" value={cond.value} onChange={(e) => set({ ...cond, value: e.target.value })} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          <select
            className={`${inputClass} mb-4 border-dashed text-white/60`}
            value=""
            onChange={(e) => update(rule.id, { conditions: [...rule.conditions, newCondition(e.target.value as Condition["kind"])] })}
          >
            <option value="">+ Add another condition…</option>
            {CONDITIONS.map((c) => (
              <option key={c.kind} value={c.kind}>
                {c.label}
              </option>
            ))}
          </select>

          <div className="mb-1.5 text-[12px] font-semibold text-white/55">…then change this:</div>
          {rule.actions.map((action, i) => {
            const set = (a: Action) => update(rule.id, { actions: rule.actions.map((x, j) => (j === i ? a : x)) });
            return (
              <div key={i} className="mb-2 rounded-xl border border-white/10 p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <select className={inputClass} value={action.kind} onChange={(e) => set(newAction(e.target.value as Action["kind"], doc))}>
                    {ACTIONS.map((a) => (
                      <option key={a.kind} value={a.kind}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    icon="close"
                    title="Remove this change"
                    className="px-1.5"
                    onClick={() => update(rule.id, { actions: rule.actions.filter((_, j) => j !== i) })}
                  />
                </div>
                {action.kind === "setPanel" ? (
                  <select className={inputClass} value={action.panelId} onChange={(e) => set({ ...action, panelId: e.target.value })}>
                    {doc.panels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {action.kind === "setAccent" ? (
                  <ColorField value={action.color} onChange={(color) => set({ ...action, color })} swatches={ACCENT_SWATCHES} />
                ) : null}
                {action.kind === "setFont" ? (
                  <select className={inputClass} value={action.fontFamily} onChange={(e) => set({ ...action, fontFamily: e.target.value })}>
                    {FONTS.map((f) => (
                      <option key={f} value={f}>
                        {f === "system-ui" ? "Device default" : f}
                      </option>
                    ))}
                  </select>
                ) : null}
                {action.kind === "setBackground" ? (
                  <div className="grid gap-2">
                    <select
                      className={inputClass}
                      value={action.background.kind}
                      onChange={(e) => set({ ...action, background: { ...action.background, kind: e.target.value as "solid" } })}
                    >
                      <option value="solid">A colour</option>
                      <option value="gradient">A blend of two colours</option>
                      <option value="image">A picture</option>
                    </select>
                    <Field label={action.background.kind === "gradient" ? "Colours" : "Colour"}>
                      <div className="flex gap-2">
                        <ColorField value={action.background.color} onChange={(color) => set({ ...action, background: { ...action.background, color } })} />
                        {action.background.kind === "gradient" ? (
                          <ColorField value={action.background.color2} onChange={(color2) => set({ ...action, background: { ...action.background, color2 } })} />
                        ) : null}
                      </div>
                    </Field>
                    {action.background.kind === "image" ? (
                      <input
                        className={inputClass}
                        placeholder="Picture link"
                        value={action.background.imageUrl}
                        onChange={(e) => set({ ...action, background: { ...action.background, imageUrl: e.target.value } })}
                      />
                    ) : null}
                  </div>
                ) : null}
                {action.kind === "setWidgetVisible" ? (
                  <div className="flex gap-2">
                    <select className={`${inputClass} w-28`} value={action.visible ? "show" : "hide"} onChange={(e) => set({ ...action, visible: e.target.value === "show" })}>
                      <option value="show">Show</option>
                      <option value="hide">Hide</option>
                    </select>
                    <select className={inputClass} value={action.widgetId} onChange={(e) => set({ ...action, widgetId: e.target.value })}>
                      <option value="">Pick a component…</option>
                      {widgets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            );
          })}
          <select
            className={`${inputClass} border-dashed text-white/60`}
            value=""
            onChange={(e) => update(rule.id, { actions: [...rule.actions, newAction(e.target.value as Action["kind"], doc)] })}
          >
            <option value="">+ Add another change…</option>
            {ACTIONS.map((a) => (
              <option key={a.kind} value={a.kind}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </Dialog>
  );
}
