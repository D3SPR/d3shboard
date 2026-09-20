import { useMemo, useRef, useState } from "react";
import {
  addItem,
  clampBox,
  convertToCanvas,
  isCanvas,
  raiseItem,
  removeItem,
  updateItem,
  updateItemNode,
} from "../components/canvasEdit";
import { definitionFor } from "../components/library";
import { renderComponent } from "../components/render";
import type { CanvasItem, ColorRole, CompNode, ComponentDef, ComponentInstance, Value } from "../components/types";
import { SOURCE_GROUPS, kindsInGroup, sourceKind } from "../data/registry";
import { useDataStore } from "../data/store";
import { formatValue } from "../data/format";
import type { FieldDef } from "../data/types";
import { FONTS, rectFor } from "../lib/board";
import type { BreakpointKey, Widget, WidgetStyle } from "../lib/types";
import { Icon, type IconName } from "./icons";
import { ACCENT_SWATCHES } from "./Toolbar";
import { Button, ColorField, Dialog, Disclosure, Field, Intro, Section, Segmented, Slider, Toggle, inputClass } from "./kit";

const PREVIEW = { w: 470, h: 300 };
const SNAP = 0.01;

const COLOR_CHOICES: { value: ColorRole; label: string }[] = [
  { value: "text", label: "Normal" },
  { value: "muted", label: "Faded" },
  { value: "accent", label: "Highlight" },
  { value: "positive", label: "Good" },
  { value: "negative", label: "Bad" },
];

const ICON_CHOICES: IconName[] = [
  "sun", "moon", "cloud", "cloudSun", "rain", "snow", "storm", "fog", "droplet",
  "clock", "calendar", "timer", "trophy", "news", "gauge", "activity", "pin", "globe",
  "zap", "sparkles", "check", "eye", "layers", "image", "text", "data", "plus",
];

type Picked = { kind: string; path: string; label: string; source: string };

type MakerProps = {
  widget: Widget;
  bp: BreakpointKey;
  update: (id: string, patch: Partial<Widget>) => void;
  /** Adds the data source for a kind if the dashboard hasn't got one, and returns its id. */
  ensureSource: (kind: string) => string;
  onClose: () => void;
  onOpenSettings: (tab: "position" | "motion") => void;
};

export function ComponentMaker(props: MakerProps) {
  const instance = props.widget.component;
  const def = instance ? definitionFor(instance.defId) : null;
  if (!instance || !def)
    return (
      <Dialog title="Design" icon="layers" onClose={props.onClose} width={560}>
        <Intro>This component's design is missing, so there's nothing to edit.</Intro>
      </Dialog>
    );
  return <Maker {...props} instance={instance} def={def} />;
}

function Maker({
  widget,
  bp,
  update,
  ensureSource,
  onClose,
  onOpenSettings,
  instance,
  def,
}: MakerProps & { instance: ComponentInstance; def: ComponentDef }) {
  const store = useDataStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState<null | "new" | string>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const tree = instance.tree ?? def.root;
  const canvas = isCanvas(tree) ? tree : null;
  const rect = rectFor(widget, bp);
  const scale = Math.min(PREVIEW.w / rect.w, PREVIEW.h / rect.h, 1);
  const style = widget.style;

  const setInstance = (patch: Partial<ComponentInstance>) => update(widget.id, { component: { ...instance, ...patch } });
  const setTree = (next: CompNode) => setInstance({ tree: next });
  const setStyle = (patch: Partial<WidgetStyle>) => update(widget.id, { style: { ...style, ...patch } });
  const setParam = (key: string, value: string | number) => setInstance({ params: { ...instance.params, [key]: value } });

  const item = canvas?.items.find((i) => i.id === selected) ?? null;

  /** Drag to move, or drag the corner to resize — both in fractions of the card. */
  const startDrag = (event: React.PointerEvent, target: CanvasItem, mode: "move" | "resize") => {
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    setSelected(target.id);
    const area = canvasRef.current?.getBoundingClientRect();
    if (!area) return;
    const from = { x: event.clientX, y: event.clientY };
    const origin = { ...target };
    const snap = (n: number) => Math.round(n / SNAP) * SNAP;

    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - from.x) / area.width;
      const dy = (e.clientY - from.y) / area.height;
      const box =
        mode === "move"
          ? { x: origin.x + dx, y: origin.y + dy, w: origin.w, h: origin.h }
          : { x: origin.x, y: origin.y, w: origin.w + dx, h: origin.h + dy };
      const fitted = clampBox(box);
      setTree(updateItem(canvas, target.id, { x: snap(fitted.x), y: snap(fitted.y), w: snap(fitted.w), h: snap(fitted.h) }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const place = (node: CompNode, box?: Partial<CanvasItem>) => {
    const sheet = canvas ?? { kind: "canvas" as const, items: [] };
    const added = addItem(sheet, node, box);
    setTree(added.canvas);
    setSelected(added.id);
  };

  /** Dropping a value in sets up its data source if the dashboard hasn't got one. */
  const useVariable = (picked: Picked) => {
    const sourceId = ensureSource(picked.kind);
    const slots = instance.sources[sourceId] ? instance.sources : { ...instance.sources, [sourceId]: sourceId };
    const value: Value = { bind: sourceId, path: picked.path };
    const target = picking && picking !== "new" && canvas ? canvas.items.find((i) => i.id === picking) : null;

    if (target && "value" in target.node) {
      setInstance({ sources: slots, tree: updateItemNode(canvas!, target.id, { ...target.node, value } as CompNode) });
    } else {
      const sheet = canvas ?? { kind: "canvas" as const, items: [] };
      const added = addItem(sheet, { kind: "text", value, scale: 1.4, weight: 600 });
      setInstance({ sources: slots, tree: added.canvas });
      setSelected(added.id);
    }
    setPicking(null);
  };

  return (
    <Dialog
      title="Design this component"
      subtitle={`${def.name} — drag the pieces, then style them below.`}
      icon="layers"
      onClose={onClose}
      width={760}
      footer={
        <>
          <Button icon="move" onClick={() => onOpenSettings("position")}>
            Position
          </Button>
          <Button icon="sparkles" onClick={() => onOpenSettings("motion")}>
            Motion
          </Button>
          <Button variant="primary" className="flex-1" icon="check" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {/* The card at its real shape, with draggable pieces on top of it. */}
      <div className="mb-3 grid place-items-center rounded-xl border border-white/10 bg-black/30 p-4">
        <div
          className="relative"
          style={{
            width: rect.w * scale,
            height: rect.h * scale,
            background: style.bg,
            color: style.fg,
            border: `${style.borderWidth}px solid ${style.border}`,
            borderRadius: style.radius * scale,
            padding: style.padding * scale,
            fontSize: `${16 * scale}px`,
            fontFamily: style.fontFamily === "inherit" ? undefined : `"${style.fontFamily}", system-ui`,
            opacity: style.opacity,
          }}
          onPointerDown={() => setSelected(null)}
        >
          <div ref={canvasRef} className="relative h-full w-full">
            <div className="pointer-events-none absolute inset-0">
              {renderComponent({ def, instance: { ...instance, tree }, states: store.states, sources: store.sources, preview: true })}
            </div>

            {canvas?.items.map((piece) => {
              const active = piece.id === selected;
              return (
                <div
                  key={piece.id}
                  onPointerDown={(e) => startDrag(e, piece, "move")}
                  onDoubleClick={() => setTree(raiseItem(canvas, piece.id))}
                  className={`absolute cursor-grab rounded-[3px] ${active ? "outline-2 outline-[var(--accent)]" : "outline-1 outline-white/20 hover:outline-white/50"}`}
                  style={{
                    left: `${piece.x * 100}%`,
                    top: `${piece.y * 100}%`,
                    width: `${piece.w * 100}%`,
                    height: `${piece.h * 100}%`,
                    outlineStyle: active ? "solid" : "dashed",
                  }}
                >
                  {active ? (
                    <span
                      onPointerDown={(e) => startDrag(e, piece, "resize")}
                      className="absolute -right-1 -bottom-1 h-3 w-3 cursor-nwse-resize rounded-full bg-[var(--accent)]"
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* A hidden copy at the real content size: measuring it turns a self-arranging design draggable. */}
      <div className="pointer-events-none fixed top-0 -left-[9999px]" aria-hidden>
        <div
          ref={measureRef}
          style={{
            width: Math.max(40, rect.w - style.padding * 2),
            height: Math.max(40, rect.h - style.padding * 2),
            fontSize: 16,
            fontFamily: style.fontFamily === "inherit" ? undefined : `"${style.fontFamily}", system-ui`,
          }}
        >
          {renderComponent({ def, instance: { ...instance, tree }, states: store.states, sources: store.sources, preview: true })}
        </div>
      </div>

      {canvas ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Button variant="primary" icon="data" onClick={() => setPicking("new")}>
            Add a value
          </Button>
          <Button icon="text" onClick={() => place({ kind: "text", value: "Text", scale: 1 })}>
            Text
          </Button>
          <Button icon="sun" onClick={() => place({ kind: "icon", value: "sun", scale: 1.6, color: "accent" }, { w: 0.2, h: 0.2 })}>
            Icon
          </Button>
          <Button icon="image" onClick={() => place({ kind: "image", value: "", grow: true, fit: "cover" }, { w: 0.4, h: 0.4 })}>
            Picture
          </Button>
          <Button icon="gauge" onClick={() => place({ kind: "bar", value: "50", max: "100", color: "accent" }, { h: 0.08 })}>
            Bar
          </Button>
          <Button icon="layers" onClick={() => place({ kind: "divider" }, { h: 0.06 })}>
            Line
          </Button>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-[12.5px] leading-relaxed text-white/60">
            This design arranges itself to fit whatever size you give it. Take control to drag its pieces around freely —
            good for a look of your own, though it stops reflowing by itself afterwards.
          </p>
          <Button
            icon="move"
            onClick={() => {
              setTree(convertToCanvas(tree, measureRef.current));
              setSelected(null);
            }}
          >
            Take control of the layout
          </Button>
        </div>
      )}

      {item && canvas ? (
        <Section title="This piece" hint="Only this piece changes. Leave a setting alone and it follows the whole component.">
          <PieceSettings
            item={item}
            onChange={(node) => setTree(updateItemNode(canvas, item.id, node))}
            onBox={(patch) => setTree(updateItem(canvas, item.id, patch))}
            onPick={() => setPicking(item.id)}
            onRemove={() => {
              setTree(removeItem(canvas, item.id));
              setSelected(null);
            }}
          />
        </Section>
      ) : null}

      <Section title="The whole component" hint="Everything inside follows these, unless it has a setting of its own.">
        <Field label="Background" stacked>
          <ColorField
            value={style.bg}
            onChange={(bg) => setStyle({ bg })}
            withAlpha
            swatches={["#15131fE6", "#00000000", "#ffffff14", "#0c1726d9", "#1a0f18d9"]}
          />
        </Field>
        <Field label="Text colour" stacked>
          <ColorField value={style.fg} onChange={(fg) => setStyle({ fg })} swatches={["#efedf7", "#ffffff", "#22201c", ...ACCENT_SWATCHES.slice(0, 3)]} />
        </Field>
        <Field label="Font" stacked>
          <select className={inputClass} value={style.fontFamily} onChange={(e) => setStyle({ fontFamily: e.target.value })}>
            <option value="inherit">Same as the page</option>
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f === "system-ui" ? "Device default" : f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Text grows with the box" help="On: everything scales as you resize the component. Off: you set the text size.">
          <Toggle checked={style.autoFit} onChange={(autoFit) => setStyle({ autoFit })} label="Text grows with the box" />
        </Field>
        {!style.autoFit ? (
          <Field label="Text size">
            <Slider value={style.fontSize} min={6} max={120} onChange={(fontSize) => setStyle({ fontSize })} unit="px" label="Text size" />
          </Field>
        ) : null}
        <Field label="Rounded corners">
          <Slider value={style.radius} min={0} max={60} onChange={(radius) => setStyle({ radius })} unit="px" label="Rounded corners" />
        </Field>
        <Disclosure title="More looks">
          <Field label="Border thickness">
            <Slider value={style.borderWidth} min={0} max={12} onChange={(borderWidth) => setStyle({ borderWidth })} unit="px" label="Border thickness" />
          </Field>
          <Field label="Border colour" stacked>
            <ColorField value={style.border} onChange={(border) => setStyle({ border })} withAlpha />
          </Field>
          <Field label="Space inside">
            <Slider value={style.padding} min={0} max={80} onChange={(padding) => setStyle({ padding })} unit="px" label="Space inside" />
          </Field>
          <Field label="Shadow" stacked>
            <Segmented
              size="sm"
              value={style.shadow}
              onChange={(shadow) => setStyle({ shadow })}
              options={[
                { value: "none", label: "None" },
                { value: "soft", label: "Soft" },
                { value: "hard", label: "Hard" },
                { value: "glow", label: "Glow" },
              ]}
            />
          </Field>
        </Disclosure>
      </Section>

      {(def.params ?? []).length ? (
        <Section title="Settings" hint="Options this design offers.">
          {(def.params ?? []).map((p) => {
            const value = instance.params[p.key] ?? p.default;
            return (
              <Field key={p.key} label={p.label} help={p.hint} stacked={p.kind !== "number"}>
                {p.kind === "number" && p.min !== undefined && p.max !== undefined ? (
                  <Slider value={Number(value)} min={p.min} max={p.max} onChange={(v) => setParam(p.key, v)} label={p.label} />
                ) : p.kind === "number" ? (
                  <input
                    className={`${inputClass} max-w-[120px] text-right`}
                    type="number"
                    value={String(value)}
                    aria-label={p.label}
                    onChange={(e) => setParam(p.key, e.target.value === "" ? "" : Number(e.target.value))}
                  />
                ) : p.kind === "select" ? (
                  <Segmented
                    value={String(value)}
                    onChange={(v) => setParam(p.key, v)}
                    options={(p.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
                  />
                ) : p.kind === "toggle" ? (
                  <Toggle checked={String(value) === "yes"} onChange={(on) => setParam(p.key, on ? "yes" : "no")} label={p.label} />
                ) : (
                  <input className={inputClass} value={String(value)} onChange={(e) => setParam(p.key, e.target.value)} />
                )}
              </Field>
            );
          })}
        </Section>
      ) : null}

      {picking ? <VariableSheet onPick={useVariable} onClose={() => setPicking(null)} /> : null}
    </Dialog>
  );
}

function PieceSettings({
  item,
  onChange,
  onBox,
  onPick,
  onRemove,
}: {
  item: CanvasItem;
  onChange: (node: CompNode) => void;
  onBox: (patch: Partial<CanvasItem>) => void;
  onPick: () => void;
  onRemove: () => void;
}) {
  const node = item.node;
  const patch = (p: Partial<CompNode>) => onChange({ ...node, ...p } as CompNode);
  const shows = "value" in node ? node.value : null;

  return (
    <>
      {shows !== null && shows !== undefined ? (
        <Field label="Shows" stacked>
          <div className="flex items-center gap-1.5">
            {typeof shows === "string" ? (
              <input className={inputClass} value={shows} onChange={(e) => patch({ value: e.target.value } as Partial<CompNode>)} />
            ) : (
              <span className="flex-1 truncate rounded-lg bg-white/[0.06] px-2.5 py-2 text-[12.5px] text-white/80">
                {"param" in shows ? `Setting: ${shows.param}` : shows.path}
              </span>
            )}
            <Button icon="data" title="Show a value from your data" onClick={onPick} className="px-2.5" />
          </div>
        </Field>
      ) : null}

      {node.kind === "text" || node.kind === "icon" ? (
        <Field label="Size">
          <Slider value={node.scale ?? 1} min={0.4} max={6} step={0.1} onChange={(scale) => patch({ scale } as Partial<CompNode>)} unit="×" label="Size" />
        </Field>
      ) : null}

      {node.kind === "text" ? (
        <>
          <Field label="Bold">
            <Toggle checked={(node.weight ?? 400) >= 600} onChange={(on) => patch({ weight: on ? 700 : 400 } as Partial<CompNode>)} label="Bold" />
          </Field>
          <Field label="Capitals">
            <Toggle checked={!!node.caps} onChange={(caps) => patch({ caps } as Partial<CompNode>)} label="Capitals" />
          </Field>
        </>
      ) : null}

      {node.kind === "text" || node.kind === "icon" || node.kind === "bar" ? (
        <Field label="Colour" stacked>
          <Segmented
            size="sm"
            value={(node.color ?? "text") as ColorRole}
            onChange={(color) => patch({ color, ...(node.kind === "bar" ? {} : { tint: undefined }) } as Partial<CompNode>)}
            options={COLOR_CHOICES}
          />
          {node.kind !== "bar" ? (
            <div className="mt-2">
              <ColorField value={node.tint ?? "#ffffff"} onChange={(tint) => patch({ tint } as Partial<CompNode>)} swatches={ACCENT_SWATCHES} />
            </div>
          ) : null}
        </Field>
      ) : null}

      {node.kind === "text" ? (
        <Field label="Font" stacked>
          <select
            className={inputClass}
            value={node.font ?? ""}
            onChange={(e) => patch({ font: e.target.value || undefined } as Partial<CompNode>)}
          >
            <option value="">Same as the component</option>
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f === "system-ui" ? "Device default" : f}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {node.kind === "icon" && typeof node.value === "string" ? (
        <Field label="Symbol" stacked>
          <div className="grid max-h-28 grid-cols-9 gap-1 overflow-y-auto rounded-lg border border-white/10 p-1.5">
            {ICON_CHOICES.map((name) => (
              <button
                key={name}
                title={name}
                onClick={() => patch({ value: name } as Partial<CompNode>)}
                className={`grid h-7 place-items-center rounded transition ${node.value === name ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "text-white/70 hover:bg-white/10"}`}
              >
                <Icon name={name} size={14} />
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      <Field label="Line up" stacked>
        <Segmented
          size="sm"
          value={item.align ?? "start"}
          onChange={(align) => onBox({ align })}
          options={[
            { value: "start", label: "Left" },
            { value: "center", label: "Middle" },
            { value: "end", label: "Right" },
          ]}
        />
      </Field>

      <Button variant="danger" icon="trash" className="w-full" onClick={onRemove}>
        Remove this piece
      </Button>
    </>
  );
}

/** Every value the dashboard could show, whether or not that data is set up yet. */
function VariableSheet({ onPick, onClose }: { onPick: (picked: Picked) => void; onClose: () => void }) {
  const store = useDataStore();
  const [query, setQuery] = useState("");

  const all = useMemo(() => {
    const out: (Picked & { live: string | null })[] = [];
    const push = (kindKey: string, sourceName: string, field: FieldDef, prefix = "", parent?: FieldDef) => {
      const source = store.sources.find((s) => s.kind === kindKey);
      const raw = source ? store.states[source.id]?.value?.[field.key] : undefined;
      const live =
        parent || raw === undefined
          ? null
          : field.type === "list"
            ? `${Array.isArray(raw) ? raw.length : 0} items`
            : formatValue(raw, field.type, field.format);
      out.push({
        kind: kindKey,
        path: prefix + field.key,
        label: parent ? `${parent.label} → first → ${field.label}` : field.label,
        source: sourceName,
        live,
      });
    };
    for (const group of SOURCE_GROUPS) {
      for (const kind of kindsInGroup(group)) {
        const name = store.sources.find((s) => s.kind === kind.kind)?.name ?? kind.label;
        for (const field of kind.fields) {
          push(kind.kind, name, field);
          for (const child of field.of ?? []) push(kind.kind, name, child, `${field.key}.0.`, field);
        }
      }
    }
    return out;
  }, [store.sources, store.states]);

  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((v) => `${v.source} ${v.label}`.toLowerCase().includes(q)) : all.filter((v) => !v.path.includes(".0."));
  const inUse = new Set(store.sources.map((s) => s.kind));

  return (
    <Dialog
      title="Pick a value"
      subtitle="Anything here can go on your component — the data behind it is set up for you."
      icon="data"
      onClose={onClose}
      width={520}
    >
      <input
        className={`${inputClass} mb-3`}
        placeholder="Search values…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-white/10">
        {shown.slice(0, 400).map((v, i) => (
          <button
            key={`${v.kind}-${v.path}-${i}`}
            onClick={() => onPick(v)}
            className="flex w-full items-center gap-2.5 border-b border-white/[0.06] px-2.5 py-2 text-left transition last:border-0 hover:bg-white/[0.08]"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--accent)]/15 text-[var(--accent)]">
              <Icon name={sourceKind(v.kind)?.icon ?? "data"} size={12} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px]">{v.label}</span>
              <span className="block truncate text-[11px] text-white/45">
                {v.source}
                {inUse.has(v.kind) ? "" : " · will be added"}
              </span>
            </span>
            {v.live ? <span className="shrink-0 text-[11.5px] text-white/60">{v.live}</span> : null}
          </button>
        ))}
        {!shown.length ? <p className="px-3 py-6 text-center text-[13px] text-white/45">Nothing matches that.</p> : null}
      </div>
    </Dialog>
  );
}
