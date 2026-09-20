import type { CSSProperties, ReactNode } from "react";
import { MISSING, formatValue, mergeFormat } from "../data/format";
import { fieldAt, sourceKind } from "../data/registry";
import { useDataStore } from "../data/store";
import type { DataSource, FieldDef, FormatDef, SourceState } from "../data/types";
import { getPath } from "../lib/util";
import { Icon, type IconName } from "../ui/icons";
import { parseChecklist, useComponentActions, writeChecklist, type ParamValue } from "./interaction";
import { definitionFor } from "./library";
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
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5em", justifyContent: "center" }}>
      <button type="button" aria-label="Less" style={button} onClick={() => nudge(-step)}>
        −
      </button>
      <span style={{ fontSize: `${SIZES[node.size ?? "xl"]}em`, fontWeight: 700, minWidth: "2em", textAlign: "center" }}>
        {formatValue(value, "number", { unit: node.unit })}
      </span>
      <button type="button" aria-label="More" style={button} onClick={() => nudge(step)}>
        +
      </button>
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
      {shown.map((item, i) => (
        <button
          key={`${item.text}-${i}`}
          type="button"
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
        </button>
      ))}
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

  return (
    <button
      type="button"
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
    </button>
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
