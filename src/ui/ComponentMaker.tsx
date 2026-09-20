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
import type { DataSource } from "../data/types";
import { useDataStore } from "../data/store";
import { SourceSettings } from "./DataDialog";
import { describeRule } from "./AnimationsDialog";
import { formatValue } from "../data/format";
import type { FieldDef } from "../data/types";
import { FONTS, rectFor } from "../lib/board";
import type { AnimationRule, BreakpointKey, Rect, Screen, Widget, WidgetStyle } from "../lib/types";
import { Icon, type IconName } from "./icons";
import { ACCENT_SWATCHES } from "./Toolbar";
import { Button, ColorField, Dialog, Disclosure, Field, Intro, Section, Segmented, Slider, Toggle, inputClass } from "./kit";

const PREVIEW = { w: 560, h: 340 };
const HANDLES = ["nw", "ne", "sw", "se"] as const;

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
  screens: Screen[];
  /** The page's animations, so movement is set up here rather than somewhere else. */
  animations: AnimationRule[];
  update: (id: string, patch: Partial<Widget>) => void;
  updateRect: (id: string, patch: Partial<Rect>) => void;
  updateSource: (id: string, patch: Partial<DataSource>) => void;
  /** Adds the data source for a kind if the dashboard hasn't got one, and returns its id. */
  ensureSource: (kind: string) => string;
  onEditAnimation: (ruleId: string) => void;
  onNewAnimation: (widgetId: string) => void;
  onSaveToLibrary: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
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
  screens,
  animations,
  update,
  updateRect,
  updateSource,
  ensureSource,
  onEditAnimation,
  onNewAnimation,
  onSaveToLibrary,
  onDuplicate,
  onRemove,
  onClose,
  instance,
  def,
}: MakerProps & { instance: ComponentInstance; def: ComponentDef }) {
  const store = useDataStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState<null | "new" | string>(null);
  const [gridSize, setGridSize] = useState(10);
  const [snapOn, setSnapOn] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
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

  // Pieces are stored as fractions of the card, but dragging and snapping work in the
  // card's own pixels — the same feel as moving things around the page itself.
  const inner = { w: Math.max(40, rect.w - style.padding * 2), h: Math.max(40, rect.h - style.padding * 2) };
  const snapPx = (n: number) => (snapOn ? Math.round(n / gridSize) * gridSize : Math.round(n));
  const toFraction = (box: { x: number; y: number; w: number; h: number }) =>
    clampBox({ x: box.x / inner.w, y: box.y / inner.h, w: box.w / inner.w, h: box.h / inner.h });

  const startDrag = (event: React.PointerEvent, target: CanvasItem, mode: "move" | (typeof HANDLES)[number]) => {
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    setSelected(target.id);
    const from = { x: event.clientX, y: event.clientY };
    const origin = {
      x: target.x * inner.w,
      y: target.y * inner.h,
      w: target.w * inner.w,
      h: target.h * inner.h,
    };

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const dx = (e.clientX - from.x) / scale;
      const dy = (e.clientY - from.y) / scale;
      let { x, y, w, h } = origin;
      if (mode === "move") {
        x = origin.x + dx;
        y = origin.y + dy;
      } else {
        if (mode.includes("e")) w = Math.max(gridSize * 2, origin.w + dx);
        if (mode.includes("s")) h = Math.max(gridSize * 2, origin.h + dy);
        if (mode.includes("w")) {
          w = Math.max(gridSize * 2, origin.w - dx);
          x = origin.x + (origin.w - w);
        }
        if (mode.includes("n")) {
          h = Math.max(gridSize * 2, origin.h - dy);
          y = origin.y + (origin.h - h);
        }
      }
      setTree(updateItem(canvas, target.id, toFraction({ x: snapPx(x), y: snapPx(y), w: snapPx(w), h: snapPx(h) })));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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
      title={widget.title}
      subtitle={widget.title === def.name ? def.category : def.name}
      icon={def.icon}
      onClose={onClose}
      width={860}
      footer={
        <>
          <Button icon="save" title="Save to my components" onClick={onSaveToLibrary} className="px-2.5" />
          <Button icon="copy" title="Make a copy" onClick={onDuplicate} className="px-2.5" />
          <Button variant="danger" icon="trash" title="Delete" onClick={onRemove} className="px-2.5" />
          <Button variant="primary" className="flex-1" icon="check" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {/* Toolbar over the canvas, the same shape as the one over the page. */}
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {canvas ? (
          <>
            <ToolButton icon="data" label="Add a value" primary onClick={() => setPicking("new")} />
            <ToolButton icon="text" label="Text" onClick={() => place({ kind: "text", value: "Text", scale: 1 })} />
            <ToolButton
              icon="sun"
              label="Icon"
              onClick={() => place({ kind: "icon", value: "sun", scale: 1.6, color: "accent" }, { w: 0.22, h: 0.22 })}
            />
            <ToolButton
              icon="image"
              label="Picture"
              onClick={() => place({ kind: "image", value: "", grow: true, fit: "cover" }, { w: 0.4, h: 0.4 })}
            />
            <ToolButton icon="gauge" label="Bar" onClick={() => place({ kind: "bar", value: "50", max: "100", color: "accent" }, { h: 0.08 })} />
            <ToolButton icon="layers" label="Line" onClick={() => place({ kind: "divider" }, { h: 0.06 })} />
          </>
        ) : (
          <ToolButton
            icon="move"
            label="Rearrange it yourself"
            onClick={() => {
              setTree(convertToCanvas(tree, measureRef.current));
              setSelected(null);
            }}
          />
        )}
      </div>

      {/* The card at its real shape, with the pieces on it. */}
      <div className="grid place-items-center rounded-xl border border-white/10 bg-black/30 p-4">
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
            {canvas && showGrid ? (
              <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  backgroundImage: "radial-gradient(circle, var(--accent) 1px, transparent 1px)",
                  backgroundSize: `${gridSize * scale}px ${gridSize * scale}px`,
                  opacity: 0.25,
                }}
              />
            ) : null}

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
                  className={`absolute rounded-[3px] ${active ? "cursor-grab outline-2 outline-[var(--accent)]" : "cursor-grab outline-1 outline-white/20 hover:outline-white/50"}`}
                  style={{
                    left: `${piece.x * 100}%`,
                    top: `${piece.y * 100}%`,
                    width: `${piece.w * 100}%`,
                    height: `${piece.h * 100}%`,
                    outlineStyle: active ? "solid" : "dashed",
                    touchAction: "none",
                  }}
                >
                  {active
                    ? HANDLES.map((h) => (
                        <span
                          key={h}
                          onPointerDown={(e) => startDrag(e, piece, h)}
                          title="Drag to resize"
                          className="absolute grid h-6 w-6 place-items-center"
                          style={{
                            touchAction: "none",
                            cursor: `${h}-resize`,
                            top: h[0] === "n" ? -12 : undefined,
                            bottom: h[0] === "s" ? -12 : undefined,
                            left: h[1] === "w" ? -12 : undefined,
                            right: h[1] === "e" ? -12 : undefined,
                          }}
                        >
                          <span className="block h-2.5 w-2.5 rounded-full border border-black/50 bg-[var(--accent)]" />
                        </span>
                      ))
                    : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tools under the canvas, like the page's own grid controls. */}
      {canvas ? (
        <div className="mt-2 mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-white/55">
          <ToolButton icon="move" label="Snap to grid" onClick={() => setSnapOn(!snapOn)} active={snapOn} />
          <ToolButton icon="layers" label="Show grid" onClick={() => setShowGrid(!showGrid)} active={showGrid} />
          <span className="ml-1 flex items-center gap-1.5">
            Spacing
            <Slider value={gridSize} min={2} max={40} onChange={setGridSize} unit="px" label="Grid spacing" />
          </span>
          {item ? (
            <>
              <ToolButton icon="copy" label="Bring to front" onClick={() => setTree(raiseItem(canvas, item.id))} />
              <ToolButton
                icon="trash"
                label="Remove"
                danger
                onClick={() => {
                  setTree(removeItem(canvas, item.id));
                  setSelected(null);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

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

      {!canvas ? (
        <p className="mb-4 text-[12px] leading-relaxed text-white/45">
          This design arranges itself to fit any size. Rearranging it yourself lets you drag its pieces around, but it
          stops reflowing on its own.
        </p>
      ) : null}

      {item && canvas ? (
        <Section title="This piece" hint="Anything you leave alone follows the component.">
          <PieceSettings
            item={item}
            onChange={(node) => setTree(updateItemNode(canvas, item.id, node))}
            onBox={(patch) => setTree(updateItem(canvas, item.id, patch))}
            onPick={() => setPicking(item.id)}
          />
        </Section>
      ) : null}

      {def.needs.length ? (
        <Section title="Data">
          {def.needs.map((need) => {
            const id = instance.sources[need.key];
            const source = store.sources.find((s) => s.id === id);
            const options = store.sources.filter((s) => s.kind === need.kind);
            return (
              <div key={need.key} className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                {options.length > 1 ? (
                  <Field label={need.label} stacked>
                    <select
                      className={inputClass}
                      value={id ?? ""}
                      onChange={(e) => setInstance({ sources: { ...instance.sources, [need.key]: e.target.value } })}
                    >
                      {options.map((o) => (
                        <option key={o.id} value={o.id} className="bg-[#1b1928]">
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
                {source ? (
                  <SourceSettings source={source} update={(patch) => updateSource(source.id, patch)} />
                ) : (
                  <Button
                    icon="data"
                    onClick={() => {
                      const created = ensureSource(need.kind);
                      if (created) setInstance({ sources: { ...instance.sources, [need.key]: created } });
                    }}
                  >
                    Set up {need.label.toLowerCase()}
                  </Button>
                )}
              </div>
            );
          })}
        </Section>
      ) : null}

      <Section title="Look" hint="Everything inside follows these unless it has its own.">
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
        <Section title="Options">
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

      <Section title="Size & position" hint={`On the ${(screens.find((s) => s.key === bp) ?? screens[screens.length - 1]).label.toLowerCase()} screen only.`}>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {(["x", "y", "w", "h"] as const).map((key) => (
            <label key={key} className="text-[12px]">
              <span className="mb-1 block text-white/55">{{ x: "Left", y: "Top", w: "Width", h: "Height" }[key]}</span>
              <input
                type="number"
                className={inputClass}
                value={Math.round(rect[key])}
                onChange={(e) => updateRect(widget.id, { [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <Field label="Hide on this screen">
          <Toggle checked={rect.hidden} onChange={(hidden) => updateRect(widget.id, { hidden })} label="Hide on this screen" />
        </Field>
        <Field label="Lock in place" help="Stops it being dragged or deleted by accident.">
          <Toggle checked={widget.locked} onChange={(locked) => update(widget.id, { locked })} label="Lock in place" />
        </Field>
        <Field label="Show its name" help="Puts the name at the top of the card as a small heading.">
          <Toggle checked={widget.showTitle} onChange={(showTitle) => update(widget.id, { showTitle })} label="Show its name" />
        </Field>
      </Section>

      <Section title="Movement">
        {animations.length ? (
          <div className="mb-2 overflow-hidden rounded-xl border border-white/10">
            {animations.map((rule) => (
              <button
                key={rule.id}
                onClick={() => onEditAnimation(rule.id)}
                className="flex w-full items-center gap-2 border-b border-white/[0.06] px-2.5 py-2 text-left text-[12.5px] transition last:border-0 hover:bg-white/[0.08]"
              >
                <Icon name="sparkles" size={13} className="shrink-0 text-[var(--accent)]" />
                <span className="min-w-0 flex-1 truncate">{rule.name}</span>
                <span className="shrink-0 truncate text-[11px] text-white/45">{describeRule(rule, [widget])}</span>
              </button>
            ))}
          </div>
        ) : null}
        <Button icon="sparkles" className="w-full" onClick={() => onNewAnimation(widget.id)}>
          {animations.length ? "Add another movement" : "Make this move"}
        </Button>
      </Section>

      {picking ? <VariableSheet onPick={useVariable} onClose={() => setPicking(null)} /> : null}
    </Dialog>
  );
}

function PieceSettings({
  item,
  onChange,
  onBox,
  onPick,
}: {
  item: CanvasItem;
  onChange: (node: CompNode) => void;
  onBox: (patch: Partial<CanvasItem>) => void;
  onPick: () => void;
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
          <div className="flex flex-wrap items-center gap-1.5">
            {COLOR_CHOICES.map((c) => {
              const active = !("tint" in node && node.tint) && (node.color ?? "text") === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => patch({ color: c.value, tint: undefined } as Partial<CompNode>)}
                  className={`rounded-lg px-2.5 py-1 text-[12px] transition ${active ? "bg-[var(--accent)] font-medium text-[var(--accent-ink)]" : "bg-white/[0.07] text-white/70 hover:bg-white/15"}`}
                >
                  {c.label}
                </button>
              );
            })}
            {node.kind !== "bar" ? (
              <input
                type="color"
                aria-label="A colour of your own"
                title="A colour of your own"
                value={"tint" in node && node.tint ? node.tint : "#ffffff"}
                onChange={(e) => patch({ tint: e.target.value } as Partial<CompNode>)}
                className="h-7 w-9 cursor-pointer rounded-lg border border-white/15 bg-transparent"
              />
            ) : null}
          </div>
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

    </>
  );
}

/** The same shape of button as the toolbar over the page. */
function ToolButton({
  icon,
  label,
  onClick,
  active,
  primary,
  danger,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const look = primary
    ? "bg-[var(--accent)] text-[var(--accent-ink)] font-medium hover:brightness-110"
    : danger
      ? "text-red-200 hover:bg-red-500/20"
      : active
        ? "bg-white/15 text-white"
        : "text-white/70 hover:bg-white/10 hover:text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition disabled:pointer-events-none disabled:opacity-30 ${look}`}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  );
}

/** Every value the dashboard could show, whether or not that data is set up yet. */
function VariableSheet({ onPick, onClose }: { onPick: (picked: Picked) => void; onClose: () => void }) {
  const store = useDataStore();
  const [query, setQuery] = useState("");

  const all = useMemo(() => {
    const out: (Picked & { live: string | null; terms: string })[] = [];
    const push = (kindKey: string, sourceName: string, terms: string, field: FieldDef, prefix = "", parent?: FieldDef) => {
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
        terms,
      });
    };
    for (const group of SOURCE_GROUPS) {
      for (const kind of kindsInGroup(group)) {
        const name = store.sources.find((s) => s.kind === kind.kind)?.name ?? kind.label;
        // Searching works on what people actually type — "bitcoin", "NBA", "AAPL" —
        // so each value carries its source's description and example settings too.
        const terms = [kind.label, kind.kind, kind.description, group, ...kind.params.map((p) => `${p.label} ${p.default} ${(p.options ?? []).map((o) => o.label).join(" ")}`)]
          .join(" ")
          .toLowerCase();
        for (const field of kind.fields) {
          push(kind.kind, name, terms, field);
          for (const child of field.of ?? []) push(kind.kind, name, terms, child, `${field.key}.0.`, field);
        }
      }
    }
    return out;
  }, [store.sources, store.states]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? all.filter((v) => `${v.source} ${v.label}`.toLowerCase().includes(q) || v.terms.includes(q))
    : all.filter((v) => !v.path.includes(".0."));
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
