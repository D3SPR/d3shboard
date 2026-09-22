import { useEffect, type CSSProperties, type ReactNode } from "react";
import { MISSING, formatValue, mergeFormat } from "../data/format";
import { fieldAt, sourceKind } from "../data/registry";
import { useDataStore } from "../data/store";
import type { DataSource, FieldDef, FormatDef, SourceState } from "../data/types";
import { formatDate, getPath, useTick } from "../lib/util";
import { Icon, type IconName } from "../ui/icons";
import { parseChecklist, useComponentActions, writeChecklist, type ParamValue } from "./interaction";
import { definitionFor } from "./library";
import { chime } from "./sound";
import { alarmDaysText, cityFromZone, nextPosition, nextRing, parseAlarms, parsePlaces, routineOf, stepAt, writeAlarms, type Alarm } from "./timing";
import type { Align, ColorRole, CompNode, ComponentDef, ComponentInstance, ComponentNeed, SizeToken, Value } from "./types";

const SIZES: Record<SizeToken, number> = { xs: 0.7, sm: 0.85, md: 1, lg: 1.4, xl: 2, "2xl": 3, "3xl": 4.4 };

const COLORS: Record<ColorRole, string> = {
  text: "currentColor",
  muted: "currentColor",
  accent: "var(--accent)",
  positive: "#7cf5c4",
  negative: "#ff8a8a",
};

const FLEX: Record<Align, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
};

type Ctx = {
  states: Record<string, SourceState>;
  sources: DataSource[];
  /** need key → data source id */
  slots: Record<string, string>;
  params: Record<string, string | number>;
  item: unknown;
  itemFields: FieldDef[];
  /** The definition's data slots, so previews know what kind each one expects. */
  needs: ComponentNeed[];
  /** In the library browser, example values stand in for data that isn't set up yet. */
  preview: boolean;
  /** Set on a placed component, so what the viewer changes can be saved. */
  widgetId?: string;
};

/**
 * The source kind behind a slot. In a preview the slot is often empty, so it falls
 * back to the kind the definition asks for — that's what makes library cards show
 * real-looking values before anything is set up.
 */
const kindForSlot = (bind: string, ctx: Ctx) => {
  const source = ctx.sources.find((s) => s.id === ctx.slots[bind]);
  if (source) return sourceKind(source.kind);
  const need = ctx.needs.find((n) => n.key === bind);
  return ctx.preview && need ? sourceKind(need.kind) : null;
};

type Found = { raw: unknown; text: string; missing: boolean };

const asFound = (raw: unknown, field: FieldDef | null, format?: FormatDef): Found => {
  const missing = raw === null || raw === undefined || raw === "";
  const text = formatValue(raw, field?.type ?? "text", mergeFormat(field?.format, format));
  return { raw, text, missing };
};

function resolve(value: Value | undefined, ctx: Ctx): Found {
  if (value === undefined) return { raw: null, text: MISSING, missing: true };
  if (typeof value === "string") return { raw: value, text: value, missing: value === "" };

  if ("param" in value) {
    const raw = ctx.params[value.param];
    return { raw, text: raw === undefined || raw === null ? MISSING : String(raw), missing: raw === undefined };
  }

  if (value.bind === "@item") {
    const raw = getPath(ctx.item, value.path);
    const field = ctx.itemFields.find((f) => f.key === value.path.split(".")[0]) ?? null;
    return asFound(raw, field, value.format);
  }

  const sourceId = ctx.slots[value.bind];
  const kind = kindForSlot(value.bind, ctx);
  const field = kind ? fieldAt(kind, value.path) : null;
  const raw = getPath(ctx.states[sourceId ?? ""]?.value ?? null, value.path);
  if ((raw === null || raw === undefined) && ctx.preview && field) return asFound(field.example, field, value.format);
  return asFound(raw, field, value.format);
}

function listFor(node: Extract<CompNode, { kind: "repeat" }>, ctx: Ctx) {
  const sourceId = ctx.slots[node.list.bind];
  const kind = kindForSlot(node.list.bind, ctx);
  const field = kind ? fieldAt(kind, node.list.path) : null;
  const raw = getPath(ctx.states[sourceId ?? ""]?.value ?? null, node.list.path);
  const items = Array.isArray(raw) ? raw : ctx.preview && Array.isArray(field?.example) ? (field.example as unknown[]) : [];
  return { items, fields: field?.of ?? [] };
}

const truthy = (found: Found) =>
  !found.missing && found.text !== MISSING && !["no", "0", "false", ""].includes(String(found.raw).toLowerCase());

/** A colour role, or a colour of the piece's own. */
const colourOf = (role: ColorRole | undefined, tint: string | undefined) => tint || COLORS[role ?? "text"];

function Node({ node, ctx }: { node: CompNode; ctx: Ctx }): ReactNode {
  switch (node.kind) {
    case "canvas":
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {node.items.map((item) => (
            <div
              key={item.id}
              data-canvas-item={item.id}
              style={{
                position: "absolute",
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                width: `${item.w * 100}%`,
                height: `${item.h * 100}%`,
                display: "flex",
                alignItems: "center",
                justifyContent: FLEX[item.align ?? "start"],
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <Node node={item.node} ctx={ctx} />
            </div>
          ))}
        </div>
      );

    case "stack": {
      const style: CSSProperties = {
        display: "flex",
        flexDirection: node.dir === "row" ? "row" : "column",
        gap: `${node.gap ?? 0.4}em`,
        alignItems: node.align ? FLEX[node.align] : node.dir === "row" ? "center" : "stretch",
        justifyContent: FLEX[node.justify ?? "start"],
        flexWrap: node.wrap ? "wrap" : undefined,
        padding: node.pad ? `${node.pad}em` : undefined,
        background: node.bg,
        borderRadius: node.radius ? `${node.radius}em` : undefined,
        flex: node.grow ? "1 1 0" : undefined,
        minWidth: 0,
        minHeight: 0,
      };
      return (
        <div style={style}>
          {node.children.map((child, i) => (
            <Node key={i} node={child} ctx={ctx} />
          ))}
        </div>
      );
    }

    case "text": {
      const found = resolve(node.value, ctx);
      const clamp = node.lines && node.lines > 0;
      return (
        <div
          style={{
            fontSize: `${node.scale ?? SIZES[node.size ?? "md"]}em`,
            fontFamily: node.font ? `"${node.font}", system-ui` : undefined,
            fontWeight: node.weight,
            color: colourOf(node.color, node.tint),
            opacity: node.opacity ?? (node.color === "muted" ? 0.62 : undefined),
            textTransform: node.caps ? "uppercase" : undefined,
            letterSpacing: node.caps ? "0.08em" : undefined,
            lineHeight: 1.15,
            flex: node.grow ? "1 1 0" : undefined,
            minWidth: 0,
            display: clamp ? "-webkit-box" : undefined,
            WebkitBoxOrient: clamp ? "vertical" : undefined,
            WebkitLineClamp: clamp ? node.lines : undefined,
            overflow: clamp ? "hidden" : undefined,
            whiteSpace: clamp ? undefined : "pre-wrap",
          }}
        >
          {found.text}
        </div>
      );
    }

    case "icon": {
      const name = resolve(node.value, ctx).raw;
      const em = node.scale ?? SIZES[node.size ?? "md"];
      if (typeof name !== "string" || !name) return null;
      return (
        <Icon
          name={name as IconName}
          style={{ width: `${em}em`, height: `${em}em`, color: colourOf(node.color, node.tint), flexShrink: 0 }}
        />
      );
    }

    case "image": {
      const found = resolve(node.value, ctx);
      if (found.missing || typeof found.raw !== "string") return null;
      const em = node.size ?? 1.6;
      return (
        <img
          src={found.raw}
          alt=""
          loading="lazy"
          style={{
            width: node.grow ? "100%" : `${em}em`,
            height: node.grow ? "100%" : `${em}em`,
            objectFit: node.fit ?? "cover",
            borderRadius: `${node.radius ?? 0.2}em`,
            flexShrink: 0,
          }}
        />
      );
    }

    case "bar": {
      const found = resolve(node.value, ctx);
      const max = Number(resolve(node.max ?? "100", ctx).raw) || 100;
      const pct = Math.max(0, Math.min(100, (Number(found.raw) / max) * 100));
      return (
        <div style={{ width: "100%", height: "0.42em", borderRadius: "999px", background: "rgba(255,255,255,.14)" }}>
          <div
            style={{
              width: `${Number.isFinite(pct) ? pct : 0}%`,
              height: "100%",
              borderRadius: "999px",
              background: COLORS[node.color ?? "accent"],
            }}
          />
        </div>
      );
    }

    case "divider":
      return <div style={{ height: 1, width: "100%", background: "currentColor", opacity: 0.14, flexShrink: 0 }} />;

    case "spacer":
      return <div style={{ flex: "1 1 0" }} />;

    case "repeat": {
      const { items, fields } = listFor(node, ctx);
      const limit = Math.max(1, Number(resolve(node.limit ?? "5", ctx).raw) || 5);
      const shown = items.slice(0, limit);
      if (!shown.length)
        return (
          <div style={{ opacity: 0.45, fontSize: "0.85em" }}>{node.empty ?? "Nothing right now."}</div>
        );
      return (
        <div
          style={{
            display: "flex",
            flexDirection: node.dir === "row" ? "row" : "column",
            gap: `${node.gap ?? 0.4}em`,
            overflow: node.scroll ? "auto" : "hidden",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {shown.map((item, i) => (
            <Node key={i} node={node.item} ctx={{ ...ctx, item, itemFields: fields }} />
          ))}
        </div>
      );
    }

    case "if": {
      const found = resolve(node.value, ctx);
      const text = String(found.raw ?? "").toLowerCase();
      const pass =
        node.is !== undefined
          ? text === node.is.toLowerCase()
          : node.not !== undefined
            ? text !== node.not.toLowerCase()
            : truthy(found);
      const branch = pass ? node.then : node.else;
      return branch ? <Node node={branch} ctx={ctx} /> : null;
    }

    case "field":
      return <FieldNode node={node} ctx={ctx} />;

    case "stepper":
      return <StepperNode node={node} ctx={ctx} />;

    case "checklist":
      return <ChecklistNode node={node} ctx={ctx} />;

    case "button":
      return <ButtonNode node={node} ctx={ctx} />;

    case "timer":
      return node.mode === "alarm" ? <AlarmNode node={node} ctx={ctx} /> : <TimerNode node={node} ctx={ctx} />;
    case "clocks":
      return <ClocksNode node={node} ctx={ctx} />;

    default:
      return null;
  }
}

/** Writes a setting back, but only on a placed component — previews stay read-only. */
const useSetParam = (ctx: Ctx) => {
  const actions = useComponentActions();
  return (key: string, value: ParamValue | ((prev: ParamValue | undefined) => ParamValue)) => {
    if (ctx.widgetId) actions.setParam(ctx.widgetId, key, value);
  };
};

const flatInput: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "inherit",
  font: "inherit",
  padding: 0,
  resize: "none",
};

/**
 * Previews and library cards are themselves buttons, so the interactive pieces render
 * as plain text there — a button inside a button is invalid, and a preview shouldn't
 * be clickable anyway. They come alive once the component is on a page.
 */
const inert = (ctx: Ctx) => !ctx.widgetId;

function FieldNode({ node, ctx }: { node: Extract<CompNode, { kind: "field" }>; ctx: Ctx }) {
  const setParam = useSetParam(ctx);
  const value = String(ctx.params[node.param] ?? "");
  const style: CSSProperties = {
    ...flatInput,
    fontSize: `${SIZES[node.size ?? "md"]}em`,
    fontWeight: node.weight,
    color: COLORS[node.color ?? "text"],
    opacity: node.color === "muted" ? 0.62 : undefined,
    lineHeight: 1.25,
    flex: node.grow ? "1 1 auto" : undefined,
    minHeight: node.grow ? "2.5em" : undefined,
  };
  if (inert(ctx))
    return <div style={{ ...style, whiteSpace: "pre-wrap" }}>{value || node.placeholder || ""}</div>;

  const props = {
    value,
    placeholder: node.placeholder,
    style,
    onChange: (e: { target: { value: string } }) => setParam(node.param, e.target.value),
  };
  return node.multiline ? <textarea {...props} style={{ ...style, height: node.grow ? "100%" : undefined }} /> : <input {...props} />;
}

function StepperNode({ node, ctx }: { node: Extract<CompNode, { kind: "stepper" }>; ctx: Ctx }) {
  const setParam = useSetParam(ctx);
  const value = Number(ctx.params[node.param] ?? 0) || 0;
  const step = (node.stepParam ? Number(ctx.params[node.stepParam]) : node.step) || node.step || 1;
  // Counts from the saved value, not the rendered one, so quick taps all land.
  const nudge = (by: number) =>
    setParam(node.param, (prev) => {
      const from = Number(prev ?? 0) || 0;
      return Math.min(node.max ?? Infinity, Math.max(node.min ?? -Infinity, Math.round((from + by) * 1000) / 1000));
    });
  const button: CSSProperties = {
    display: "grid",
    placeItems: "center",
    width: "1.6em",
    height: "1.6em",
    borderRadius: "999px",
    border: "1px solid currentColor",
    opacity: 0.45,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    lineHeight: 1,
    cursor: "pointer",
    flexShrink: 0,
  };
  const Tap = inert(ctx) ? "span" : "button";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5em", justifyContent: "center" }}>
      <Tap aria-label="Less" style={button} onClick={() => nudge(-step)}>
        −
      </Tap>
      <span style={{ fontSize: `${SIZES[node.size ?? "xl"]}em`, fontWeight: 700, minWidth: "2em", textAlign: "center" }}>
        {formatValue(value, "number", { unit: node.unit })}
      </span>
      <Tap aria-label="More" style={button} onClick={() => nudge(step)}>
        +
      </Tap>
    </div>
  );
}

function ChecklistNode({ node, ctx }: { node: Extract<CompNode, { kind: "checklist" }>; ctx: Ctx }) {
  const setParam = useSetParam(ctx);
  const items = parseChecklist(ctx.params[node.param]);
  const shown = items.slice(0, node.limit ?? 12);
  const size = SIZES[node.size ?? "sm"];

  const toggle = (index: number) =>
    setParam(node.param, (prev) =>
      writeChecklist(parseChecklist(prev).map((item, i) => (i === index ? { ...item, done: !item.done } : item))),
    );

  const add = (text: string) => {
    const clean = text.trim();
    if (clean) setParam(node.param, (prev) => writeChecklist([...parseChecklist(prev), { text: clean, done: false }]));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.45em", fontSize: `${size}em`, minHeight: 0, overflow: "auto" }}>
      {shown.map((item, i) => {
        const Row = inert(ctx) ? "span" : "button";
        return (
        <Row
          key={`${item.text}-${i}`}
          onClick={() => toggle(i)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.55em",
            background: "transparent",
            border: "none",
            color: "inherit",
            font: "inherit",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: "1.15em",
              height: "1.15em",
              flexShrink: 0,
              borderRadius: "0.3em",
              border: "1px solid currentColor",
              opacity: item.done ? 1 : 0.4,
              background: item.done ? "var(--accent)" : "transparent",
              color: item.done ? "var(--accent-ink)" : "inherit",
              fontSize: "0.8em",
            }}
          >
            {item.done ? "✓" : ""}
          </span>
          <span style={{ opacity: item.done ? 0.45 : 1, textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
        </Row>
        );
      })}
      {ctx.widgetId ? (
        <input
          placeholder={node.placeholder ?? "Add something…"}
          style={{ ...flatInput, opacity: 0.55, fontSize: "0.95em" }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            add(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
        />
      ) : null}
    </div>
  );
}

type Patch = Record<string, ParamValue>;

/** 83000 → "01:23", 3723000 → "1:02:03"; stopwatches add tenths. */
const clockText = (ms: number, tenths = false) => {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const sec = Math.floor((total % 60_000) / 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  const main = h ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
  return tenths ? `${main}.${Math.floor((total % 1000) / 100)}` : main;
};

/** A remaining time shown while counting down: rounded up, so it reads 00:01 until it really is zero. */
const countdownText = (ms: number) => clockText(Math.ceil(Math.max(0, ms) / 1000) * 1000);

/** The round buttons under a timer or alarm; plain text in previews, where a button would sit inside one. */
const pill = (live: boolean) => (label: string, onClick: () => void, primary = false) => {
  const Tap = live ? "button" : "span";
  return (
    <Tap
      key={label}
      onClick={onClick}
      style={{
        padding: "0.35em 0.95em",
        borderRadius: "999px",
        border: primary ? "none" : "1px solid currentColor",
        background: primary ? "var(--accent)" : "transparent",
        color: primary ? "var(--accent-ink)" : "inherit",
        opacity: primary ? 1 : 0.75,
        font: "inherit",
        fontSize: "0.8em",
        fontWeight: primary ? 700 : 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Tap>
  );
};

const untilText = (ms: number) => {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `in ${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `in ${h}h ${min % 60}m` : `in ${Math.floor(h / 24)}d ${h % 24}h`;
};

/**
 * Any number of alarms, each on chosen days. Rings while the dashboard is open, until
 * stopped (or for five minutes), and can be snoozed. `rang` remembers which alarm last
 * went off at which minute, so a second tab or a re-render doesn't ring it twice.
 */
function AlarmNode({ node, ctx }: { node: Extract<CompNode, { kind: "timer" }>; ctx: Ctx }) {
  const actions = useComponentActions();
  const live = !inert(ctx);
  const p = ctx.params;
  useTick(1000);
  const alarms = parseAlarms(p.alarms);
  const now = new Date();
  const hour12 = String(p.clock ?? "24") === "12";
  const snoozeMin = Math.max(1, Number(p.snooze) || 9);
  const ringingSince = Number(p.ringing) || 0;
  const ringing = ringingSince > 0 && now.getTime() - ringingSince < 5 * 60_000;
  const snoozeUntil = Number(p.snoozeUntil) || 0;
  const ringingAlarm = alarms.find((a) => a.id === p.ringingId);

  const patch = (fn: (prev: Patch) => Patch) => {
    if (ctx.widgetId) actions.patchParams(ctx.widgetId, fn);
  };

  // Start ringing when an alarm's minute arrives, or a snooze runs out.
  useEffect(() => {
    if (!live) return;
    const minute = formatDate(now, "YYYY-MM-DD HH:mm");
    const hm = formatDate(now, "HH:mm");
    if (snoozeUntil && now.getTime() >= snoozeUntil) {
      patch((prev): Patch => (Number(prev.snoozeUntil) === snoozeUntil ? { snoozeUntil: 0, ringing: Date.now() } : {}));
      return;
    }
    const due = alarms.find((a) => a.on && a.time === hm && (a.once || !a.days.length || a.days.includes(now.getDay())));
    if (!due || String(p.rang) === `${due.id}@${minute}`) return;
    patch((prev): Patch => {
      if (String(prev.rang) === `${due.id}@${minute}`) return {};
      const list = parseAlarms(prev.alarms).map((a) => (a.id === due.id && a.once ? { ...a, on: false } : a));
      return { rang: `${due.id}@${minute}`, ringing: Date.now(), ringingId: due.id, snoozeUntil: 0, alarms: writeAlarms(list) };
    });
  });

  useEffect(() => {
    if (!live || !ringing) return;
    chime(4);
    const id = setInterval(() => chime(4), 2000);
    return () => clearInterval(id);
  }, [live, ringing]);

  const control = pill(live);
  const timeText = (hm: string) => {
    if (!hour12) return hm;
    const [h, m] = hm.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };

  const upcoming = alarms
    .map((a) => ({ a, at: nextRing(a, now) }))
    .filter((x): x is { a: Alarm; at: Date } => !!x.at)
    .sort((x, y) => x.at.getTime() - y.at.getTime());
  const next = upcoming[0];

  let caption = "";
  let display = "";
  let buttons: ReactNode[] = [];
  if (ringing) {
    caption = `${ringingAlarm?.label || "Alarm"} — ringing`;
    display = timeText(ringingAlarm?.time ?? formatDate(now, "HH:mm"));
    buttons = [
      control("Stop", () => patch((): Patch => ({ ringing: 0, snoozeUntil: 0 })), true),
      control(`Snooze ${snoozeMin}m`, () => patch((): Patch => ({ ringing: 0, snoozeUntil: Date.now() + snoozeMin * 60_000 }))),
    ];
  } else if (snoozeUntil > now.getTime()) {
    caption = `${ringingAlarm?.label || "Alarm"} · snoozing`;
    display = countdownText(snoozeUntil - now.getTime());
    buttons = [control("Stop", () => patch((): Patch => ({ snoozeUntil: 0 })), true)];
  } else if (next) {
    caption = `${next.a.label || "Alarm"} · ${untilText(next.at.getTime() - now.getTime())}`;
    display = timeText(next.a.time);
  } else {
    caption = alarms.length ? "All alarms off" : "No alarms yet";
    display = "--:--";
  }

  const toggle = (id: string) =>
    patch((prev): Patch => ({ alarms: writeAlarms(parseAlarms(prev.alarms).map((a) => (a.id === id ? { ...a, on: !a.on } : a))) }));
  const Tap = live ? "button" : "span";
  const big = SIZES[node.size ?? "2xl"];
  const listed = ringing || snoozeUntil > now.getTime() ? [] : alarms.filter((a) => a.id !== next?.a.id || alarms.length > 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.45em", width: "100%" }}>
      <div style={{ fontSize: "0.75em", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, textAlign: "center", color: ringing ? "var(--accent)" : undefined, opacity: ringing ? 1 : 0.6 }}>
        {caption}
      </div>
      <div style={{ fontSize: `${big}em`, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: ringing ? "var(--accent)" : undefined }}>{display}</div>
      {buttons.length ? <div style={{ display: "flex", gap: "0.4em", flexWrap: "wrap", justifyContent: "center" }}>{buttons}</div> : null}
      {listed.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35em", justifyContent: "center", maxWidth: "100%" }}>
          {listed.slice(0, 6).map((a) => (
            <Tap
              key={a.id}
              onClick={() => toggle(a.id)}
              title={a.on ? "Tap to turn off" : "Tap to turn on"}
              style={{
                display: "inline-flex",
                gap: "0.35em",
                alignItems: "baseline",
                padding: "0.2em 0.6em",
                borderRadius: 999,
                border: "1px solid currentColor",
                background: "transparent",
                color: "inherit",
                font: "inherit",
                fontSize: "0.7em",
                opacity: a.on ? 0.85 : 0.35,
                textDecoration: a.on ? undefined : "line-through",
                cursor: "pointer",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <b>{timeText(a.time)}</b>
              <span>{alarmDaysText(a)}</span>
            </Tap>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TimerNode({ node, ctx }: { node: Extract<CompNode, { kind: "timer" }>; ctx: Ctx }) {
  const actions = useComponentActions();
  const live = !inert(ctx);
  const p = ctx.params;
  const run = Number(p.run) || 0;
  const running = run > 0;
  useTick(running ? 100 : 1000);

  const now = Date.now();
  const elapsed = (Number(p.acc) || 0) + (running ? now - run : 0);
  // The countdown and focus timer became one step-based timer; old designs still name them.
  const mode = node.mode === "countdown" || node.mode === "pomodoro" ? "intervals" : node.mode;

  const patch = (fn: (prev: Patch) => Patch) => {
    if (ctx.widgetId) actions.patchParams(ctx.widgetId, fn);
  };

  // The routine: which step of which round, and how long that step lasts.
  const routine = routineOf(p);
  const stepIndex = Math.min(Math.max(0, Number(p.step) || 0), routine.steps.length - 1);
  const round = Math.max(1, Number(p.round) || 1);
  const step = stepAt(routine, stepIndex, round);
  const total = mode === "intervals" ? step.sec * 1000 : 0;
  const remaining = Math.max(0, total - elapsed);
  // Older saves marked a finished countdown only by banking its whole length.
  const complete = mode === "intervals" && (Number(p.complete) === 1 || (!running && total > 0 && elapsed >= total));
  const sound = String(p.sound ?? "yes") !== "no";
  const multi = routine.steps.length > 1 || routine.rounds !== 1;

  /** Moves past the current step: the next one (running or waiting), or the end of the routine. */
  const advance = (prev: Patch, keepRunning: boolean): Patch => {
    const r = routineOf(prev);
    const at = Math.min(Math.max(0, Number(prev.step) || 0), r.steps.length - 1);
    const next = nextPosition(r, at, Math.max(1, Number(prev.round) || 1));
    if (!next) return { run: 0, acc: stepAt(r, at, Number(prev.round) || 1).sec * 1000, complete: 1 };
    return { step: next.step, round: next.round, acc: 0, run: keepRunning ? Date.now() : 0 };
  };

  // Reaching the end of a step: chime, then move on by itself or wait for a tap.
  useEffect(() => {
    if (!live || mode !== "intervals" || !running || elapsed < total) return;
    const last = !nextPosition(routine, stepIndex, round);
    if (sound) chime(last ? 4 : 2);
    patch((prev): Patch => {
      if (Number(prev.run) !== run) return {}; // another tab already handled it
      return advance(prev, routineOf(prev).auto);
    });
  });

  const start = () =>
    patch((prev): Patch => {
      if (Number(prev.run)) return {};
      // Starting a finished routine starts it over.
      if (complete || Number(prev.complete) === 1) return { run: Date.now(), acc: 0, step: 0, round: 1, complete: 0 };
      return { run: Date.now(), acc: Number(prev.acc) || 0 };
    });
  const pause = () =>
    patch((prev): Patch => {
      const since = Number(prev.run) || 0;
      return since ? { run: 0, acc: (Number(prev.acc) || 0) + (Date.now() - since) } : {};
    });
  const reset = () => patch((): Patch => ({ run: 0, acc: 0, laps: "", step: 0, round: 1, complete: 0 }));
  const lap = () =>
    patch((prev): Patch => {
      const since = Number(prev.run) || 0;
      const at = (Number(prev.acc) || 0) + (since ? Date.now() - since : 0);
      return { laps: [String(Math.round(at)), ...String(prev.laps || "").split(",").filter(Boolean)].slice(0, 20).join(",") };
    });
  const addMinute = () => patch((prev): Patch => ({ acc: (Number(prev.acc) || 0) - 60_000 }));
  const skip = () => patch((prev): Patch => (Number(prev.complete) === 1 ? {} : advance(prev, !!Number(prev.run))));

  const control = pill(live);

  const big = SIZES[node.size ?? "2xl"];
  const label = String(p.label || "");
  const laps = String(p.laps || "").split(",").filter(Boolean).map(Number);

  let caption = label;
  let display = "";
  let buttons: ReactNode[] = [];
  let footer = "";
  let progress: number | null = null;
  const done = complete;

  if (mode === "stopwatch") {
    display = clockText(elapsed, true);
    buttons = [running ? control("Pause", pause, true) : control(elapsed ? "Resume" : "Start", start, true), running ? control("Lap", lap) : control("Reset", reset)];
  } else if (mode === "intervals") {
    // Stopped at the very start of a step that isn't the first: the routine is waiting for a tap.
    const waiting = !running && !complete && elapsed === 0 && (stepIndex > 0 || round > 1);
    display = countdownText(complete ? 0 : remaining);
    const roundText = routine.rounds === 1 ? "" : routine.rounds ? ` · Round ${round} of ${routine.rounds}` : ` · Round ${round}`;
    caption = complete ? (multi ? "All done" : "Time's up") : `${waiting ? "Next: " : ""}${step.name || "Timer"}${roundText}`;
    progress = total && !complete ? Math.min(1, elapsed / total) : complete ? 1 : 0;
    const primary = running
      ? control("Pause", pause, true)
      : control(complete ? "Again" : waiting ? "Continue" : elapsed ? "Resume" : "Start", start, true);
    buttons = [primary];
    if (running) buttons.push(control("+1 min", addMinute));
    if (multi && !complete) buttons.push(control("Skip", skip));
    if (!running && (elapsed || stepIndex || round > 1 || complete)) buttons.push(control("Reset", reset));
    if (multi && !complete) {
      const next = nextPosition(routine, stepIndex, round);
      if (next) {
        const after = stepAt(routine, next.step, next.round);
        footer = `Then ${after.name || "the next step"} · ${countdownText(after.sec * 1000)}`;
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.45em", width: "100%" }}>
      {caption ? (
        <div style={{ fontSize: "0.75em", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, textAlign: "center", color: done ? "var(--accent)" : undefined, opacity: done ? 1 : 0.6 }}>
          {caption}
        </div>
      ) : null}
      <div style={{ fontSize: `${big}em`, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: done ? "var(--accent)" : undefined }}>
        {display}
      </div>
      {progress !== null && multi ? (
        <div style={{ width: "70%", height: "0.3em", borderRadius: 999, background: "rgba(127,127,127,.25)" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", borderRadius: 999, background: "var(--accent)" }} />
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "0.4em", flexWrap: "wrap", justifyContent: "center" }}>{buttons}</div>
      {footer ? <div style={{ fontSize: "0.72em", opacity: 0.55, fontVariantNumeric: "tabular-nums" }}>{footer}</div> : null}
      {mode === "stopwatch" && laps.length ? (
        <div style={{ fontSize: "0.75em", opacity: 0.6, fontVariantNumeric: "tabular-nums", textAlign: "center" }}>
          {laps.slice(0, 3).map((t, i) => (
            <div key={i}>
              Lap {laps.length - i} · {clockText(t, true)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The time in a zone as hours and minutes, plus how its calendar day compares with here. */
const zoneTime = (tz: string, now: Date, hour12: boolean) => {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12, ...(tz ? { timeZone: tz } : {}) };
  try {
    const time = new Intl.DateTimeFormat(hour12 ? "en-US" : "en-GB", opts).format(now);
    const there = new Date(now.toLocaleString("en-US", tz ? { timeZone: tz } : {}));
    const here = new Date(now.toLocaleString("en-US"));
    const hours = Math.round((there.getTime() - here.getTime()) / 36e5 * 2) / 2;
    const dayGap = Math.round((new Date(there.toDateString()).getTime() - new Date(here.toDateString()).getTime()) / 864e5);
    const offset = hours === 0 ? "Same time" : `${hours > 0 ? "+" : "−"}${Math.abs(hours)}h`;
    const day = dayGap > 0 ? "Tomorrow" : dayGap < 0 ? "Yesterday" : "Today";
    return { time, offset, day, night: there.getHours() < 6 || there.getHours() >= 20 };
  } catch {
    return { time: "—", offset: "Unknown zone", day: "", night: false };
  }
};

function ClocksNode({ node, ctx }: { node: Extract<CompNode, { kind: "clocks" }>; ctx: Ctx }) {
  useTick(1000);
  const places = parsePlaces(ctx.params.places);
  const hour12 = String(ctx.params.clock ?? "24") === "12";
  const details = String(ctx.params.details ?? "yes") !== "no";
  const now = new Date();
  if (!places.length) return <div style={{ opacity: 0.55, fontSize: "0.85em", textAlign: "center" }}>Add a place in this clock's options.</div>;
  const single = places.length === 1;
  const timeSize = single ? SIZES[node.size ?? "2xl"] : SIZES[node.size ?? "lg"];
  return (
    <div
      style={{
        // Wrapping flex rather than a grid, so a last row with fewer places stays centred.
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignContent: "center",
        gap: "0.9em 0.7em",
        width: "100%",
      }}
    >
      {places.map((place, i) => {
        const t = zoneTime(place.tz, now, hour12);
        return (
          <div key={i} style={{ flex: `1 1 ${Math.max(5, timeSize * 3.2)}em`, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15em", minWidth: 0 }}>
            <div style={{ fontSize: "0.72em", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, color: "var(--accent)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
              {place.label || cityFromZone(place.tz)}
            </div>
            <div style={{ fontSize: `${timeSize}em`, fontWeight: 700, lineHeight: 1.05, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {t.time}
            </div>
            {details ? (
              <div style={{ fontSize: "0.68em", opacity: 0.55, whiteSpace: "nowrap" }}>
                {t.night ? "☾ " : ""}
                {t.day}
                {place.tz ? ` · ${t.offset}` : ""}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ButtonNode({ node, ctx }: { node: Extract<CompNode, { kind: "button" }>; ctx: Ctx }) {
  const setParam = useSetParam(ctx);
  const actions = useComponentActions();

  const run = () => {
    if (node.action === "refresh") {
      const slot = node.slot ?? Object.keys(ctx.slots)[0];
      const id = ctx.slots[slot ?? ""];
      if (id) actions.refreshSource(id);
      return;
    }
    if (!node.param) return;
    if (node.action === "set") setParam(node.param, node.to ?? "");
    if (node.action === "add") setParam(node.param, (prev) => (Number(prev ?? 0) || 0) + (node.amount ?? 1));
  };

  const Tap = inert(ctx) ? "span" : "button";
  return (
    <Tap
      onClick={run}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.4em",
        alignSelf: "center",
        padding: "0.35em 0.9em",
        borderRadius: "999px",
        border: "1px solid currentColor",
        background: "transparent",
        color: "inherit",
        font: "inherit",
        fontSize: "0.85em",
        opacity: 0.75,
        cursor: "pointer",
      }}
    >
      {node.icon ? <Icon name={node.icon} style={{ width: "1.1em", height: "1.1em" }} /> : null}
      {node.label}
    </Tap>
  );
}

export function renderComponent({
  def,
  instance,
  states,
  sources,
  preview,
  widgetId,
}: {
  def: ComponentDef;
  instance: ComponentInstance;
  states: Record<string, SourceState>;
  sources: DataSource[];
  preview?: boolean;
  widgetId?: string;
}) {
  const params: Record<string, string | number> = {
    ...Object.fromEntries((def.params ?? []).map((p) => [p.key, p.default])),
    ...instance.params,
  };
  const ctx: Ctx = {
    states,
    sources,
    slots: instance.sources ?? {},
    params,
    item: null,
    itemFields: [],
    needs: def.needs,
    preview: !!preview,
    widgetId,
  };
  return <Node node={instance.tree ?? def.root} ctx={ctx} />;
}

/** Draws a placed component. Missing data shows as dashes rather than breaking the layout. */
export function ComponentView({ instance, widgetId }: { instance: ComponentInstance | undefined; widgetId?: string }) {
  const store = useDataStore();
  const def = instance ? definitionFor(instance.defId) : null;
  if (!instance || !def)
    return <div style={{ opacity: 0.5, fontSize: "0.9em" }}>This component isn't set up yet.</div>;
  const freeform = (instance.tree ?? def.root).kind === "canvas";
  return (
    // Components position themselves, so they ignore the card's own text alignment.
    <div
      style={{
        display: freeform ? "block" : "flex",
        height: "100%",
        width: "100%",
        minWidth: 0,
        flexDirection: "column",
        justifyContent: "safe center",
        textAlign: "start",
      }}
    >
      {renderComponent({ def, instance, states: store.states, sources: store.sources, widgetId })}
    </div>
  );
}
