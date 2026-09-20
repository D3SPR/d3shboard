import { useState } from "react";
import type { SavedComponent } from "../components/types";
import type { DataStore } from "../data/store";
import type { DataSource } from "../data/types";
import type { WidgetType } from "../lib/types";
import { LibraryPanel } from "./ComponentLibrary";
import { DataPanel } from "./DataDialog";
import { Icon } from "./icons";
import { Dialog } from "./kit";

export type AddTab = "components" | "data";

const TABS: { id: AddTab; label: string; icon: "layers" | "data"; blurb: string }[] = [
  { id: "components", label: "Components", icon: "layers", blurb: "Things to put on the page." },
  { id: "data", label: "Data", icon: "data", blurb: "Live information they can show." },
];

/**
 * One place to add things. Components and the data behind them were two separate
 * menus, which meant knowing in advance which one you needed.
 */
export function AddDialog({
  tab,
  setTab,
  saved,
  sources,
  setSources,
  store,
  onPick,
  onPickSaved,
  onForgetSaved,
  onAddBasic,
  onClose,
}: {
  tab: AddTab;
  setTab: (tab: AddTab) => void;
  saved: SavedComponent[];
  sources: DataSource[];
  setSources: (next: DataSource[]) => void;
  store: DataStore;
  onPick: (defId: string) => void;
  onPickSaved: (savedId: string) => void;
  onForgetSaved: (savedId: string) => void;
  onAddBasic: (type: WidgetType) => void;
  onClose: () => void;
}) {
  // Dragging a basic onto the page needs the dialog out of the way to drop it.
  const [dragging, setDragging] = useState(false);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <Dialog
      onClose={onClose}
      width={680}
      hidden={dragging}
      header={
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
              <Icon name="plus" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">Add</h2>
              <p className="text-[12.5px] leading-snug text-white/50">{current.blurb}</p>
            </div>
          </div>
          <div className="flex gap-1 rounded-lg bg-white/[0.06] p-0.5" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === tab}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] transition ${
                  t.id === tab ? "bg-[var(--accent)] font-medium text-[var(--accent-ink)]" : "text-white/70 hover:bg-white/10"
                }`}
              >
                <Icon name={t.icon} size={14} />
                {t.label}
                {t.id === "data" && sources.length ? (
                  <span className={`text-[11px] ${t.id === tab ? "opacity-70" : "text-white/40"}`}>{sources.length}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {tab === "components" ? (
        <LibraryPanel
          saved={saved}
          onPick={onPick}
          onPickSaved={onPickSaved}
          onForgetSaved={onForgetSaved}
          onAddBasic={onAddBasic}
          onDragBasic={setDragging}
        />
      ) : (
        <DataPanel sources={sources} setSources={setSources} store={store} />
      )}
    </Dialog>
  );
}
