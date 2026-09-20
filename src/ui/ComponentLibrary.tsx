import { useMemo, useState } from "react";
import { CATEGORIES, COMPONENTS } from "../components/library";
import { renderComponent } from "../components/render";
import type { ComponentCategory, ComponentDef, ComponentInstance } from "../components/types";
import { useDataStore } from "../data/store";
import { Icon } from "./icons";
import { Dialog, Intro, inputClass } from "./kit";

const PREVIEW = { w: 232, h: 104 };

/** Fills a definition's slots with whichever sources already exist, for previews. */
export const previewInstance = (def: ComponentDef, sourceIds: Record<string, string>): ComponentInstance => ({
  defId: def.id,
  sources: sourceIds,
  params: {},
});

function Preview({ def }: { def: ComponentDef }) {
  const store = useDataStore();
  const slots = Object.fromEntries(
    def.needs.map((need) => [need.key, store.sources.find((s) => s.kind === need.kind)?.id ?? ""]),
  );
  const scale = Math.min(PREVIEW.w / def.size.w, PREVIEW.h / def.size.h, 1);
  return (
    <div
      className="pointer-events-none relative overflow-hidden rounded-lg border border-white/[0.07] bg-black/25"
      style={{ height: PREVIEW.h }}
    >
      <div
        className="absolute inset-0 flex flex-col justify-center p-2 text-white"
        style={{ fontSize: `${Math.max(7, 16 * scale)}px`, fontFamily: "inherit" }}
      >
        {renderComponent({
          def,
          instance: previewInstance(def, slots),
          states: store.states,
          sources: store.sources,
          preview: true,
        })}
      </div>
    </div>
  );
}

export function ComponentLibrary({ onPick, onClose }: { onPick: (defId: string) => void; onClose: () => void }) {
  const [category, setCategory] = useState<ComponentCategory | "All">("All");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMPONENTS.filter(
      (c) =>
        (category === "All" || c.category === category) &&
        (!q || `${c.name} ${c.description} ${c.category}`.toLowerCase().includes(q)),
    );
  }, [category, query]);

  return (
    <Dialog
      title="Component library"
      subtitle="Ready-made designs that fill themselves in with live information."
      icon="layers"
      onClose={onClose}
      width={660}
    >
      <Intro>
        Pick one and it lands on your page, already showing real data. Everything about it can be changed afterwards — or
        deleted, if you change your mind.
      </Intro>

      <div className="sticky -top-4 z-10 -mx-4 mb-3 bg-[var(--chrome)] px-4 pb-2">
        <input
          className={`${inputClass} mb-2`}
          placeholder="Search components…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {(["All", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-lg px-2.5 py-1 text-[12.5px] transition ${
                category === c ? "bg-[var(--accent)] font-medium text-[var(--accent-ink)]" : "bg-white/[0.07] text-white/70 hover:bg-white/15"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {shown.map((def) => (
          <button
            key={def.id}
            onClick={() => onPick(def.id)}
            className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition hover:border-[var(--accent)]/60 hover:bg-white/[0.07]"
          >
            <Preview def={def} />
            <span className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[var(--accent)]/15 text-[var(--accent)]">
                <Icon name={def.icon} size={13} />
              </span>
              <span className="text-[13px] font-semibold">{def.name}</span>
            </span>
            <span className="-mt-1 text-[12px] leading-snug text-white/50">{def.description}</span>
          </button>
        ))}
      </div>

      {!shown.length ? <p className="py-6 text-center text-[13px] text-white/45">Nothing matches that.</p> : null}
    </Dialog>
  );
}
