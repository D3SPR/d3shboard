import { useMemo, useState } from "react";
import { NEW_NODES, describeNode, insertNear, isInside, moveAt, nodeAt, replaceAt, samePath, type NodePath } from "../components/edit";
import { definitionFor } from "../components/library";
import { renderComponent } from "../components/render";
import type { ColorRole, CompNode, ComponentDef, ComponentInstance, SizeToken, Value } from "../components/types";
import { fieldAt, sourceKind } from "../data/registry";
import { useDataStore } from "../data/store";
import type { FieldDef } from "../data/types";
import { rectFor } from "../lib/board";
import type { BreakpointKey, Widget } from "../lib/types";
import { Icon, type IconName } from "./icons";
import { Button, Dialog, Field, Intro, Section, Segmented, Slider, Toggle, inputClass } from "./kit";

const SIZE_OPTIONS: { value: SizeToken; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
  { value: "2xl", label: "2XL" },
  { value: "3xl", label: "3XL" },
];

const COLOR_OPTIONS: { value: ColorRole; label: string }[] = [
  { value: "text", label: "Normal" },
  { value: "muted", label: "Faded" },
  { value: "accent", label: "Highlight" },
  { value: "positive", label: "Good" },
  { value: "negative", label: "Bad" },
];

const ICON_CHOICES: IconName[] = [
  "sun", "moon", "cloud", "cloudSun", "rain", "snow", "storm", "fog", "droplet",
  "clock", "calendar", "timer", "trophy", "news", "gauge", "activity", "pin", "globe",
  "zap", "sparkles", "check", "eye", "layers", "image", "text", "data",
];

type Rows = { path: NodePath; node: CompNode; depth: number }[];

/** Flattens the tree into outline rows. */
function outline(node: CompNode, path: NodePath = [], depth = 0, rows: Rows = []): Rows {
  rows.push({ path, node, depth });
  if (node.kind === "stack") node.children.forEach((c, i) => outline(c, [...path, i], depth + 1, rows));
  if (node.kind === "repeat") outline(node.item, [...path, 0], depth + 1, rows);
  if (node.kind === "if") {
    outline(node.then, [...path, 0], depth + 1, rows);
    if (node.else) outline(node.else, [...path, 1], depth + 1, rows);
  }
  return rows;
}

type MakerProps = {
  widget: Widget;
  bp: BreakpointKey;
  update: (id: string, patch: Partial<Widget>) => void;
  onClose: () => void;
  onOpenData: () => void;
};

export function ComponentMaker(props: MakerProps) {
  const instance = props.widget.component;
  const def = instance ? definitionFor(instance.defId) : null;
  if (!instance || !def)
    return (
      <Dialog title="Component maker" icon="layers" onClose={props.onClose} width={560}>
        <Intro>This component's design is missing, so there's nothing to edit.</Intro>
      </Dialog>
    );
  return <Maker {...props} instance={instance} def={def} />;
}

function Maker({ widget, bp, update, onClose, onOpenData, instance, def }: MakerProps & { instance: ComponentInstance; def: ComponentDef }) {
  const store = useDataStore();
  const [selected, setSelected] = useState<NodePath>([]);
  const [query, setQuery] = useState("");

  const tree = instance.tree ?? def.root;

  const setInstance = (patch: Partial<ComponentInstance>) => update(widget.id, { component: { ...instance, ...patch } });

  const setTree = (next: CompNode) => setInstance({ tree: next });

  const rows = outline(tree);
  const node = nodeAt(tree, selected) ?? tree;

  /** Item fields available when the selected node sits inside a repeating list. */
  const itemFields: FieldDef[] = useMemo(() => {
    for (let i = selected.length; i > 0; i--) {
      const ancestor = nodeAt(tree, selected.slice(0, i - 1));
      if (ancestor?.kind === "repeat") {
        const sourceId = instance.sources[ancestor.list.bind] ?? ancestor.list.bind;
        const src = store.sources.find((s) => s.id === sourceId);
        const kind = src ? sourceKind(src.kind) : null;
        return (kind ? fieldAt(kind, ancestor.list.path)?.of : null) ?? [];
      }
    }
    return [];
  }, [selected, tree, instance.sources, store.sources]);

  /** Every variable from every configured source, plus the current item's fields. */
  const variables = useMemo(() => {
    const out: { label: string; group: string; value: Value; isList: boolean; path: string; bind: string }[] = [];
    for (const field of itemFields) {
      out.push({ label: field.label, group: "This item", value: { bind: "@item", path: field.key }, isList: false, path: field.key, bind: "@item" });
    }
    for (const src of store.sources) {
      const kind = sourceKind(src.kind);
      if (!kind) continue;
      for (const field of kind.fields) {
        out.push({
          label: field.label,
          group: src.name || kind.label,
          value: { bind: src.id, path: field.key },
          isList: field.type === "list",
          path: field.key,
          bind: src.id,
        });
      }
    }
    const q = query.trim().toLowerCase();
    return q ? out.filter((v) => `${v.group} ${v.label}`.toLowerCase().includes(q)) : out;
  }, [store.sources, itemFields, query]);

  /** Binding to a source the definition didn't ask for adds a slot pointing at it. */
  const ensureSlot = (bind: string) => {
    if (bind === "@item" || instance.sources[bind]) return instance.sources;
    return { ...instance.sources, [bind]: bind };
  };

  const setNode = (next: CompNode) => setTree(replaceAt(tree, selected, next));

  const useVariable = (variable: (typeof variables)[number]) => {
    const sources = ensureSlot(variable.bind);
    if (variable.isList && node.kind === "repeat") {
      setInstance({ sources, tree: replaceAt(tree, selected, { ...node, list: { bind: variable.bind, path: variable.path } }) });
      return;
    }
    if (node.kind === "text" || node.kind === "icon" || node.kind === "image" || node.kind === "bar") {
      setInstance({ sources, tree: replaceAt(tree, selected, { ...node, value: variable.value } as CompNode) });
      return;
    }
    const added = insertNear(tree, selected, { kind: "text", value: variable.value, size: "md" });
    setInstance({ sources, tree: added.tree });
    setSelected(added.path);
  };

  const addNode = (make: () => CompNode) => {
    const added = insertNear(tree, selected, make());
    setTree(added.tree);
    setSelected(added.path);
  };

  const removeNode = () => {
    if (!selected.length) return;
    setTree(replaceAt(tree, selected, null));
    setSelected(selected.slice(0, -1));
  };

  const move = (dir: -1 | 1) => {
    const moved = moveAt(tree, selected, dir);
    setTree(moved.tree);
    setSelected(moved.path);
  };

  const rect = rectFor(widget, bp);
  const previewScale = Math.min(360 / rect.w, 200 / rect.h, 1);

  return (
    <Dialog
      title="Design this component"
      subtitle={`Started from “${def.name}”. Changes only affect this one.`}
      icon="layers"
      onClose={onClose}
      width={860}
      footer={
        <>
          <Button
            icon="undo"
            onClick={() => {
              if (confirm("Throw away your changes and go back to the library design?")) {
                setInstance({ tree: undefined });
                setSelected([]);
              }
            }}
          >
            Back to the original
          </Button>
          <Button variant="primary" className="flex-1" icon="check" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <Intro>
        A component is a few pieces stacked together. Pick a piece to change it, drop your data into it, and watch the
        preview.
      </Intro>

      <div
        className="mb-4 grid place-items-center rounded-xl border border-white/10 bg-black/30 p-3"
        style={{ minHeight: rect.h * previewScale + 24 }}
      >
        <div
          className="overflow-hidden rounded-lg"
          style={{
            width: rect.w * previewScale,
            height: rect.h * previewScale,
            background: widget.style.bg,
            color: widget.style.fg,
            border: `${widget.style.borderWidth}px solid ${widget.style.border}`,
            borderRadius: widget.style.radius * previewScale,
            padding: widget.style.padding * previewScale,
            fontSize: `${16 * previewScale}px`,
            fontFamily: widget.style.fontFamily === "inherit" ? undefined : `"${widget.style.fontFamily}", system-ui`,
          }}
        >
          <div style={{ display: "flex", height: "100%", flexDirection: "column", justifyContent: "safe center", textAlign: "start" }}>
            {renderComponent({ def, instance: { ...instance, tree }, states: store.states, sources: store.sources, preview: true })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="The pieces" hint="Tap one to change it. Pieces inside a row or column are indented.">
          <div className="mb-2 overflow-hidden rounded-xl border border-white/10">
            {rows.map((row) => {
              const active = samePath(row.path, selected);
              return (
                <button
                  key={row.path.join("-") || "root"}
                  onClick={() => setSelected(row.path)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] transition ${
                    active ? "bg-[var(--accent)]/20 text-white" : isInside(row.path, selected) ? "bg-white/[0.04] text-white/70" : "text-white/70 hover:bg-white/[0.06]"
                  }`}
                  style={{ paddingLeft: 10 + row.depth * 14 }}
                >
                  <Icon name={row.node.kind === "stack" ? "layers" : row.node.kind === "repeat" ? "repeat" : "text"} size={12} className="opacity-50" />
                  <span className="truncate">{describeNode(row.node)}</span>
                </button>
              );
            })}
          </div>
          <div className="mb-2 flex gap-1">
            <Button icon="left" title="Move up" className="px-2 py-1.5" disabled={!selected.length} onClick={() => move(-1)} />
            <Button icon="right" title="Move down" className="px-2 py-1.5" disabled={!selected.length} onClick={() => move(1)} />
            <Button variant="danger" icon="trash" title="Remove this piece" className="px-2 py-1.5" disabled={!selected.length} onClick={removeNode} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NEW_NODES.map((n) => (
              <button
                key={n.label}
                title={n.hint}
                onClick={() => addNode(n.make)}
                className="rounded-lg bg-white/[0.07] px-2 py-1 text-[12px] text-white/75 transition hover:bg-white/15 hover:text-white"
              >
                + {n.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="This piece" hint={describeNode(node)}>
          <NodeInspector node={node} setNode={setNode} />
        </Section>
      </div>

      <Section title="Your data" hint="Tap a value to drop it into the piece you've picked.">
        <input className={`${inputClass} mb-2`} placeholder="Search values…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {store.sources.length ? (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10">
            {variables.map((v, i) => (
              <button
                key={`${v.bind}-${v.path}-${i}`}
                onClick={() => useVariable(v)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] text-white/75 transition hover:bg-white/[0.08] hover:text-white"
              >
                <span className="shrink-0 text-[11px] text-white/40">{v.group}</span>
                <span className="truncate">{v.label}</span>
                {v.isList ? <span className="ml-auto shrink-0 text-[10.5px] text-[var(--accent)]">list</span> : null}
              </button>
            ))}
            {!variables.length ? <p className="px-2.5 py-3 text-[12.5px] text-white/45">Nothing matches that.</p> : null}
          </div>
        ) : (
          <Button icon="data" onClick={onOpenData}>
            Add data first
          </Button>
        )}
      </Section>
    </Dialog>
  );
}

function NodeInspector({ node, setNode }: { node: CompNode; setNode: (n: CompNode) => void }) {
  const patch = (p: Partial<CompNode>) => setNode({ ...node, ...p } as CompNode);

  if (node.kind === "stack")
    return (
      <>
        <Field label="Direction" stacked>
          <Segmented
            value={node.dir}
            onChange={(dir) => patch({ dir } as Partial<CompNode>)}
            options={[
              { value: "col", label: "Top to bottom" },
              { value: "row", label: "Side by side" },
            ]}
          />
        </Field>
        <Field label="Space between">
          <Slider value={node.gap ?? 0.4} min={0} max={2} step={0.1} onChange={(gap) => patch({ gap } as Partial<CompNode>)} label="Space between" />
        </Field>
        <Field label="Line up" stacked>
          <Segmented
            size="sm"
            value={node.align ?? "start"}
            onChange={(align) => patch({ align } as Partial<CompNode>)}
            options={[
              { value: "start", label: "Start" },
              { value: "center", label: "Middle" },
              { value: "end", label: "End" },
              { value: "between", label: "Spread" },
            ]}
          />
        </Field>
      </>
    );

  if (node.kind === "text")
    return (
      <>
        {typeof node.value === "string" ? (
          <Field label="Words" stacked>
            <input className={inputClass} value={node.value} onChange={(e) => patch({ value: e.target.value } as Partial<CompNode>)} />
          </Field>
        ) : (
          <Field label="Shows" stacked>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate rounded-lg bg-white/[0.06] px-2.5 py-2 text-[12.5px] text-white/80">
                {"param" in node.value ? `Setting: ${node.value.param}` : node.value.path}
              </span>
              <Button icon="close" title="Use fixed words instead" className="px-2" onClick={() => patch({ value: "Text" } as Partial<CompNode>)} />
            </div>
          </Field>
        )}
        <Field label="Size" stacked>
          <Segmented size="sm" value={node.size ?? "md"} onChange={(size) => patch({ size } as Partial<CompNode>)} options={SIZE_OPTIONS} />
        </Field>
        <Field label="Colour" stacked>
          <Segmented size="sm" value={node.color ?? "text"} onChange={(color) => patch({ color } as Partial<CompNode>)} options={COLOR_OPTIONS} />
        </Field>
        <Field label="Bold">
          <Toggle checked={(node.weight ?? 400) >= 600} onChange={(on) => patch({ weight: on ? 700 : 400 } as Partial<CompNode>)} label="Bold" />
        </Field>
        <Field label="Capitals">
          <Toggle checked={!!node.caps} onChange={(caps) => patch({ caps } as Partial<CompNode>)} label="Capitals" />
        </Field>
        <Field label="Lines before cutting off" help="0 means never cut it off.">
          <Slider value={node.lines ?? 0} min={0} max={5} onChange={(lines) => patch({ lines } as Partial<CompNode>)} label="Lines before cutting off" />
        </Field>
      </>
    );

  if (node.kind === "icon")
    return (
      <>
        <Field label="Symbol" stacked>
          <div className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-lg border border-white/10 p-1.5">
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
          {typeof node.value !== "string" ? (
            <p className="mt-1.5 text-[12px] text-white/50">This symbol comes from your data.</p>
          ) : null}
        </Field>
        <Field label="Size" stacked>
          <Segmented size="sm" value={node.size ?? "md"} onChange={(size) => patch({ size } as Partial<CompNode>)} options={SIZE_OPTIONS} />
        </Field>
        <Field label="Colour" stacked>
          <Segmented size="sm" value={node.color ?? "text"} onChange={(color) => patch({ color } as Partial<CompNode>)} options={COLOR_OPTIONS} />
        </Field>
      </>
    );

  if (node.kind === "image")
    return (
      <>
        <Field label="Size">
          <Slider value={node.size ?? 1.6} min={0.6} max={6} step={0.2} onChange={(size) => patch({ size } as Partial<CompNode>)} unit="×" label="Size" />
        </Field>
        <Field label="Fill the space">
          <Toggle checked={!!node.grow} onChange={(grow) => patch({ grow } as Partial<CompNode>)} label="Fill the space" />
        </Field>
      </>
    );

  if (node.kind === "bar")
    return (
      <Field label="Full at" help="The value that fills the bar completely." stacked>
        <input
          className={inputClass}
          value={typeof node.max === "string" ? node.max : "from data"}
          onChange={(e) => patch({ max: e.target.value } as Partial<CompNode>)}
        />
      </Field>
    );

  if (node.kind === "repeat")
    return (
      <>
        <Field label="Repeats over" stacked>
          <span className="block truncate rounded-lg bg-white/[0.06] px-2.5 py-2 text-[12.5px] text-white/80">
            {node.list.path || "Pick a list below"}
          </span>
        </Field>
        <Field label="How many">
          <Slider
            value={Number(typeof node.limit === "string" ? node.limit : 5) || 5}
            min={1}
            max={12}
            onChange={(v) => patch({ limit: String(v) } as Partial<CompNode>)}
          />
        </Field>
        <Field label="Space between">
          <Slider value={node.gap ?? 0.4} min={0} max={2} step={0.1} onChange={(gap) => patch({ gap } as Partial<CompNode>)} label="Space between" />
        </Field>
        <Field label="Direction" stacked>
          <Segmented
            value={node.dir ?? "col"}
            onChange={(dir) => patch({ dir } as Partial<CompNode>)}
            options={[
              { value: "col", label: "Top to bottom" },
              { value: "row", label: "Side by side" },
            ]}
          />
        </Field>
        <Field label="When there's nothing" stacked>
          <input
            className={inputClass}
            value={node.empty ?? ""}
            placeholder="Nothing right now."
            onChange={(e) => patch({ empty: e.target.value } as Partial<CompNode>)}
          />
        </Field>
      </>
    );

  return <p className="text-[12.5px] text-white/50">Nothing to change on this piece.</p>;
}
