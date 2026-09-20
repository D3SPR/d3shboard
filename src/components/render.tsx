import type { CSSProperties, ReactNode } from "react";
import { MISSING, formatValue, mergeFormat } from "../data/format";
import { fieldAt, sourceKind } from "../data/registry";
import { useDataStore } from "../data/store";
import type { DataSource, FieldDef, FormatDef, SourceState } from "../data/types";
import { getPath } from "../lib/util";
import { Icon, type IconName } from "../ui/icons";
import { definitionFor } from "./library";
import type { Align, ColorRole, CompNode, ComponentDef, ComponentInstance, SizeToken, Value } from "./types";

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
  /** In the library browser, example values stand in for data that isn't set up yet. */
  preview: boolean;
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
  const source = ctx.sources.find((s) => s.id === sourceId);
  const kind = source ? sourceKind(source.kind) : null;
  const field = kind ? fieldAt(kind, value.path) : null;
  const raw = getPath(ctx.states[sourceId ?? ""]?.value ?? null, value.path);
  if ((raw === null || raw === undefined) && ctx.preview && field) return asFound(field.example, field, value.format);
  return asFound(raw, field, value.format);
}

function listFor(node: Extract<CompNode, { kind: "repeat" }>, ctx: Ctx) {
  const sourceId = ctx.slots[node.list.bind];
  const source = ctx.sources.find((s) => s.id === sourceId);
  const kind = source ? sourceKind(source.kind) : null;
  const field = kind ? fieldAt(kind, node.list.path) : null;
  const raw = getPath(ctx.states[sourceId ?? ""]?.value ?? null, node.list.path);
  const items = Array.isArray(raw) ? raw : ctx.preview && Array.isArray(field?.example) ? (field.example as unknown[]) : [];
  return { items, fields: field?.of ?? [] };
}

const truthy = (found: Found) =>
  !found.missing && found.text !== MISSING && !["no", "0", "false", ""].includes(String(found.raw).toLowerCase());

function Node({ node, ctx }: { node: CompNode; ctx: Ctx }): ReactNode {
  switch (node.kind) {
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
            fontSize: `${SIZES[node.size ?? "md"]}em`,
            fontWeight: node.weight,
            color: COLORS[node.color ?? "text"],
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
      const em = SIZES[node.size ?? "md"];
      if (typeof name !== "string" || !name) return null;
      return (
        <Icon
          name={name as IconName}
          style={{ width: `${em}em`, height: `${em}em`, color: COLORS[node.color ?? "text"], flexShrink: 0 }}
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

    default:
      return null;
  }
}

export function renderComponent({
  def,
  instance,
  states,
  sources,
  preview,
}: {
  def: ComponentDef;
  instance: ComponentInstance;
  states: Record<string, SourceState>;
  sources: DataSource[];
  preview?: boolean;
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
    preview: !!preview,
  };
  return <Node node={instance.tree ?? def.root} ctx={ctx} />;
}

/** Draws a placed component. Missing data shows as dashes rather than breaking the layout. */
export function ComponentView({ instance }: { instance: ComponentInstance | undefined }) {
  const store = useDataStore();
  const def = instance ? definitionFor(instance.defId) : null;
  if (!instance || !def)
    return <div style={{ opacity: 0.5, fontSize: "0.9em" }}>This component isn't set up yet.</div>;
  return (
    // Components position themselves with stacks, so they ignore the card's own text alignment.
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        minWidth: 0,
        flexDirection: "column",
        justifyContent: "safe center",
        textAlign: "start",
      }}
    >
      {renderComponent({ def, instance, states: store.states, sources: store.sources })}
    </div>
  );
}
