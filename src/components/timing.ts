/**
 * Plain helpers behind the timer and world clock: how their list settings are stored,
 * the ready-made timer routines, and how old saves of the timers they replaced are
 * brought forward. No React here, so the board loader and the bridge can use it too.
 */
import type { ComponentInstance } from "./types";

// ---------- Timer steps ----------

/** One part of a timer routine: "Focus" for 25 minutes, "Rest" for 20 seconds. */
export type TimerStep = { name: string; sec: number };

/** Settings are strings or numbers, so a routine is kept as JSON text. */
export const parseSteps = (raw: unknown): TimerStep[] => {
  try {
    const list = JSON.parse(String(raw ?? ""));
    if (Array.isArray(list)) {
      const steps = list
        .filter((s) => s && typeof s === "object")
        .map((s) => ({ name: String(s.name ?? ""), sec: Math.max(0, Number(s.sec) || 0) }));
      if (steps.length) return steps;
    }
  } catch {
    // Not JSON: fall through to a plain five-minute timer.
  }
  return [{ name: "Timer", sec: 300 }];
};

export const writeSteps = (steps: TimerStep[]) => JSON.stringify(steps.map((s) => ({ name: s.name, sec: Math.max(0, Math.round(s.sec)) })));

/** Starting points for the timer. Each sets every routine setting at once. */
export const TIMER_PRESETS: { id: string; label: string; hint: string; params: Record<string, string | number> }[] = [
  {
    id: "simple",
    label: "Countdown",
    hint: "One stretch of time, then a chime.",
    params: { steps: writeSteps([{ name: "Timer", sec: 300 }]), rounds: 1, longBreak: 0, auto: "auto" },
  },
  {
    id: "pomodoro",
    label: "Pomodoro",
    hint: "25 minutes of focus, 5 off, and a 15-minute break every fourth round.",
    params: {
      steps: writeSteps([
        { name: "Focus", sec: 25 * 60 },
        { name: "Short break", sec: 5 * 60 },
      ]),
      rounds: 0,
      longBreak: 15,
      longEvery: 4,
      auto: "auto",
    },
  },
  {
    id: "hiit",
    label: "Workout 40/20",
    hint: "40 seconds on, 20 off, eight rounds.",
    params: {
      steps: writeSteps([
        { name: "Work", sec: 40 },
        { name: "Rest", sec: 20 },
      ]),
      rounds: 8,
      longBreak: 0,
      auto: "auto",
    },
  },
  {
    id: "tabata",
    label: "Tabata",
    hint: "20 seconds flat out, 10 seconds rest, eight rounds.",
    params: {
      steps: writeSteps([
        { name: "Go", sec: 20 },
        { name: "Rest", sec: 10 },
      ]),
      rounds: 8,
      longBreak: 0,
      auto: "auto",
    },
  },
  {
    id: "5217",
    label: "52 / 17",
    hint: "52 minutes of work, then 17 away from the screen. Waits for you between.",
    params: {
      steps: writeSteps([
        { name: "Work", sec: 52 * 60 },
        { name: "Break", sec: 17 * 60 },
      ]),
      rounds: 0,
      longBreak: 0,
      auto: "wait",
    },
  },
];

type Params = Record<string, string | number | undefined>;

/** The routine as the timer runs it. `rounds` 0 means keep going until stopped. */
export const routineOf = (p: Params) => ({
  steps: parseSteps(p.steps),
  rounds: Math.max(0, Math.round(Number(p.rounds ?? 1) || 0)),
  longSec: Math.max(0, Number(p.longBreak) || 0) * 60,
  longEvery: Math.max(1, Math.round(Number(p.longEvery) || 4)),
  auto: String(p.auto ?? "auto") !== "wait",
});

type Routine = ReturnType<typeof routineOf>;

/** The step at a position, with the long break standing in for the last step every few rounds. */
export const stepAt = (r: Routine, index: number, round: number): TimerStep => {
  const i = Math.min(Math.max(0, index), r.steps.length - 1);
  const isLast = i === r.steps.length - 1 && r.steps.length > 1;
  if (isLast && r.longSec > 0 && round % r.longEvery === 0) return { name: "Long break", sec: r.longSec };
  return r.steps[i];
};

/** Where the routine goes after a step ends, or null once every round is done. */
export const nextPosition = (r: Routine, index: number, round: number): { step: number; round: number } | null => {
  if (index + 1 < r.steps.length) return { step: index + 1, round };
  if (r.rounds === 0 || round < r.rounds) return { step: 0, round: round + 1 };
  return null;
};

// ---------- World clock places ----------

export type Place = { label: string; tz: string };

export const parsePlaces = (raw: unknown): Place[] => {
  try {
    const list = JSON.parse(String(raw ?? ""));
    if (Array.isArray(list))
      return list.filter((p) => p && typeof p.tz === "string").map((p) => ({ label: String(p.label ?? cityFromZone(p.tz)), tz: p.tz }));
  } catch {
    // Not JSON: no places yet.
  }
  return [];
};

export const writePlaces = (places: Place[]) => JSON.stringify(places);

/** "America/New_York" → "New York". An empty zone is this device's own. */
export const cityFromZone = (tz: string) => (tz ? (tz.split("/").pop() ?? tz).replace(/_/g, " ") : "Here");

/** Every time zone the browser knows, for searching when there's no connection. */
export const allZones = (): string[] => {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];
  }
};

// ---------- Old saves ----------

/**
 * The countdown and focus timer were merged into one step-based timer, and the world
 * clock became a grid that keeps its own places instead of borrowing a time source.
 * Old placed copies are rewritten here so nothing a person set up is lost.
 */
export function migrateInstance(instance: ComponentInstance, sourceZone: (id: string) => string | undefined): ComponentInstance {
  const p = instance.params ?? {};
  if (instance.defId === "time.pomodoro") {
    const phase = String(p.phase ?? "work");
    return {
      ...instance,
      defId: "time.timer",
      params: {
        ...p,
        steps: writeSteps([
          { name: "Focus", sec: (Number(p.work ?? 25) || 25) * 60 },
          { name: "Short break", sec: (Number(p.short ?? 5) || 5) * 60 },
        ]),
        rounds: 0,
        longBreak: Number(p.long ?? 15) || 0,
        longEvery: Number(p.every ?? 4) || 4,
        auto: "auto",
        step: phase === "work" ? 0 : 1,
        round: Math.max(1, (Number(p.done) || 0) + (phase === "work" ? 1 : 0)),
      },
    };
  }
  if (instance.defId === "time.timer" && p.steps === undefined && (p.minutes !== undefined || p.seconds !== undefined || p.label !== undefined)) {
    const sec = (Number(p.minutes ?? 5) || 0) * 60 + (Number(p.seconds) || 0);
    return {
      ...instance,
      params: { ...p, steps: writeSteps([{ name: String(p.label || "Timer"), sec: sec || 300 }]), rounds: 1 },
    };
  }
  // An edited design still reads its time source, so only untouched world clocks move over.
  if (instance.defId === "time.world" && p.places === undefined && !instance.tree && instance.sources?.time) {
    const id = instance.sources?.time;
    const tz = (id && sourceZone(id)) || "";
    return {
      ...instance,
      sources: {},
      params: { ...p, places: writePlaces([{ label: String(p.label || cityFromZone(tz)), tz }]) },
    };
  }
  if (instance.defId === "time.alarm" && p.alarms === undefined && (p.at !== undefined || p.label !== undefined || p.armed !== undefined)) {
    const alarm: Alarm = { id: "a1", time: String(p.at || "07:00"), label: String(p.label ?? "Wake up"), days: [], on: String(p.armed ?? "yes") !== "no" };
    return { ...instance, params: { ...p, alarms: writeAlarms([alarm]) } };
  }
  return instance;
}

// ---------- Alarms ----------

/** One alarm. `days` are 0 (Sunday) to 6; none means every day. `once` switches itself off after ringing. */
export type Alarm = { id: string; time: string; label: string; days: number[]; on: boolean; once?: boolean };

export const parseAlarms = (raw: unknown): Alarm[] => {
  try {
    const list = JSON.parse(String(raw ?? ""));
    if (Array.isArray(list))
      return list
        .filter((a) => a && typeof a === "object")
        .map((a, i) => ({
          id: String(a.id ?? `a${i}`),
          time: /^\d{1,2}:\d{2}$/.test(String(a.time)) ? String(a.time).padStart(5, "0") : "07:00",
          label: String(a.label ?? ""),
          days: Array.isArray(a.days) ? a.days.map(Number).filter((d: number) => d >= 0 && d <= 6) : [],
          on: a.on !== false,
          once: !!a.once,
        }));
  } catch {
    // Not JSON: no alarms yet.
  }
  return [];
};

export const writeAlarms = (alarms: Alarm[]) => JSON.stringify(alarms);

const DAY_LETTERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Every day", "Weekdays", "Mon, Wed" — or "Once". */
export const alarmDaysText = (a: Alarm) => {
  if (a.once) return "Once";
  const d = [...a.days].sort();
  if (!d.length || d.length === 7) return "Every day";
  if (d.join() === "1,2,3,4,5") return "Weekdays";
  if (d.join() === "0,6") return "Weekends";
  return d.map((n) => DAY_LETTERS[n]).join(", ");
};

/** When an alarm next goes off after `from`, or null if it's switched off. */
export const nextRing = (a: Alarm, from: Date): Date | null => {
  if (!a.on) return null;
  const [h, m] = a.time.split(":").map(Number);
  for (let i = 0; i < 8; i++) {
    const at = new Date(from);
    at.setDate(from.getDate() + i);
    at.setHours(h || 0, m || 0, 0, 0);
    if (at.getTime() <= from.getTime()) continue;
    if (a.once || !a.days.length || a.days.includes(at.getDay())) return at;
  }
  return null;
};
