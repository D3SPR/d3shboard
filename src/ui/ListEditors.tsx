import { useMemo, useState } from "react";
import { searchPlaces } from "../data/sources/weather";
import {
  TIMER_PRESETS,
  allZones,
  cityFromZone,
  parseAlarms,
  parsePlaces,
  parseSteps,
  writeAlarms,
  writePlaces,
  writeSteps,
  type Alarm,
} from "../components/timing";
import { Button, NumberField, inputClass } from "./kit";

type Params = Record<string, string | number>;

const rowClass = "flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-1.5";
const chip = (on: boolean) =>
  `rounded-full px-2.5 py-1 text-[12px] transition ${on ? "bg-[var(--accent)] text-[var(--accent-ink)] font-semibold" : "bg-white/[0.07] text-white/70 hover:bg-white/15"}`;

/** The timer's routine: ready-made starting points, then each step with its own name and length. */
export function StepsEditor({ value, params, onChange }: { value: unknown; params: Params; onChange: (patch: Params) => void }) {
  const steps = parseSteps(value);
  const set = (next: typeof steps) => onChange({ steps: writeSteps(next) });
  const current = TIMER_PRESETS.find((p) => Object.entries(p.params).every(([k, v]) => String(params[k] ?? "") === String(v)));

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {TIMER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.hint}
            className={chip(current?.id === preset.id)}
            // Starting over too, so a half-run routine doesn't carry into the new one.
            onClick={() => onChange({ ...preset.params, run: 0, acc: 0, step: 0, round: 1, complete: 0 })}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {steps.map((step, i) => (
          <div key={i} className={rowClass}>
            <input
              className={`${inputClass} flex-1`}
              value={step.name}
              placeholder={`Step ${i + 1}`}
              aria-label="Step name"
              onChange={(e) => set(steps.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))}
            />
            <NumberField
              value={Math.floor(step.sec / 60)}
              unit="min"
              label="Minutes"
              onChange={(m) => set(steps.map((s, j) => (j === i ? { ...s, sec: Math.max(0, m) * 60 + (s.sec % 60) } : s)))}
            />
            <NumberField
              value={step.sec % 60}
              unit="sec"
              label="Seconds"
              onChange={(sec) => set(steps.map((s, j) => (j === i ? { ...s, sec: Math.floor(s.sec / 60) * 60 + Math.max(0, sec) } : s)))}
            />
            <Button variant="ghost" icon="trash" title="Remove step" disabled={steps.length < 2} onClick={() => set(steps.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      <Button className="mt-1.5" icon="plus" onClick={() => set([...steps, { name: steps.length % 2 ? "Rest" : "Work", sec: 60 }])}>
        Add a step
      </Button>
    </div>
  );
}

/** The world clock's places: search a city (or any time zone), rename, reorder, remove. */
export function PlacesEditor({ value, onChange }: { value: unknown; onChange: (patch: Params) => void }) {
  const places = parsePlaces(value);
  const set = (next: typeof places) => onChange({ places: writePlaces(next) });
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ label: string; name: string; tz: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const zones = useMemo(allZones, []);

  // Time zone names match straight away and work offline; the city search adds places
  // that aren't zone names (Mumbai is Asia/Kolkata).
  const q = query.trim().toLowerCase();
  const zoneMatches = q
    ? zones
        .filter((z) => z.toLowerCase().replace(/_/g, " ").includes(q))
        .slice(0, 5)
        .map((tz) => ({ label: tz.replace(/_/g, " "), name: cityFromZone(tz), tz }))
    : [];
  const results = [...found, ...zoneMatches.filter((z) => !found.some((f) => f.tz === z.tz && f.name === z.name))];

  const search = async () => {
    if (!q) return;
    setBusy(true);
    try {
      const hits = await searchPlaces(query.trim());
      setFound(hits.filter((h) => h.timezone).map((h) => ({ label: `${h.label} · ${h.timezone.replace(/_/g, " ")}`, name: h.name, tz: h.timezone })));
    } catch {
      setFound([]);
    } finally {
      setBusy(false);
    }
  };

  const add = (name: string, tz: string) => {
    set([...places, { label: name, tz }]);
    setQuery("");
    setFound([]);
  };
  const move = (i: number, by: number) => {
    const next = [...places];
    const [p] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + by)), 0, p);
    set(next);
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-1.5">
        {places.map((place, i) => (
          <div key={i} className={rowClass}>
            <input
              className={`${inputClass} flex-1`}
              value={place.label}
              aria-label="Name shown"
              onChange={(e) => set(places.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))}
            />
            <span className="max-w-[40%] shrink truncate text-[11.5px] text-white/45" title={place.tz || "This device's time zone"}>
              {place.tz ? place.tz.replace(/_/g, " ") : "This device"}
            </span>
            <Button variant="ghost" icon="left" title="Move earlier" className="rotate-90 !px-1.5" disabled={i === 0} onClick={() => move(i, -1)} />
            <Button variant="ghost" icon="trash" title="Remove" className="!px-1.5" onClick={() => set(places.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          className={inputClass}
          placeholder="Add a city or time zone"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFound([]);
          }}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button icon="search" title="Search cities" onClick={search} disabled={busy || !q} />
      </div>
      {results.length ? (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-white/10">
          {results.map((r) => (
            <button
              key={`${r.label}-${r.tz}`}
              type="button"
              onClick={() => add(r.name, r.tz)}
              className="block w-full border-b border-white/5 px-3 py-2 text-left text-[13px] text-white/80 last:border-0 hover:bg-white/10"
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : q ? (
        <p className="mt-1.5 text-[12px] text-white/45">Press Enter to search every town and city.</p>
      ) : null}
      {!places.some((p) => !p.tz) ? (
        <Button className="mt-1.5" variant="ghost" icon="pin" onClick={() => add("Here", "")}>
          Add my own time
        </Button>
      ) : null}
    </div>
  );
}

const DAYS = [
  { n: 1, l: "M" },
  { n: 2, l: "T" },
  { n: 3, l: "W" },
  { n: 4, l: "T" },
  { n: 5, l: "F" },
  { n: 6, l: "S" },
  { n: 0, l: "S" },
];

/** Every alarm: its time, name, days (or just once) and whether it's on. */
export function AlarmsEditor({ value, onChange }: { value: unknown; onChange: (patch: Params) => void }) {
  const alarms = parseAlarms(value);
  const set = (next: Alarm[]) => onChange({ alarms: writeAlarms(next) });
  const edit = (id: string, patch: Partial<Alarm>) => set(alarms.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2">
        {alarms.map((a) => (
          <div key={a.id} className={`${rowClass} flex-col !items-stretch ${a.on ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                className={`${inputClass} !w-[110px] tabular-nums [color-scheme:dark]`}
                value={a.time}
                aria-label="Time"
                onChange={(e) => e.target.value && edit(a.id, { time: e.target.value })}
              />
              <input className={`${inputClass} flex-1`} value={a.label} placeholder="Alarm" aria-label="Name" onChange={(e) => edit(a.id, { label: e.target.value })} />
              <button type="button" className={chip(a.on)} onClick={() => edit(a.id, { on: !a.on })}>
                {a.on ? "On" : "Off"}
              </button>
              <Button variant="ghost" icon="trash" title="Remove alarm" className="!px-1.5" onClick={() => set(alarms.filter((x) => x.id !== a.id))} />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" className={chip(!!a.once)} onClick={() => edit(a.id, { once: !a.once, on: true })}>
                Once
              </button>
              {DAYS.map((d) => {
                const on = !a.once && (a.days.length === 0 || a.days.includes(d.n));
                return (
                  <button
                    key={d.n}
                    type="button"
                    title={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.n]}
                    className={`${chip(on)} !w-7 !px-0`}
                    onClick={() => {
                      // No days picked means every day, so the first tap on "every day" narrows to the others.
                      const base = a.once || !a.days.length ? [0, 1, 2, 3, 4, 5, 6] : a.days;
                      const days = base.includes(d.n) ? base.filter((x) => x !== d.n) : [...base, d.n];
                      edit(a.id, { once: false, days: days.length === 7 ? [] : days.length ? days : [d.n] });
                    }}
                  >
                    {d.l}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Button
        className="mt-1.5"
        icon="plus"
        onClick={() => set([...alarms, { id: `a${Date.now().toString(36)}`, time: "08:00", label: "", days: [], on: true }])}
      >
        Add an alarm
      </Button>
    </div>
  );
}
