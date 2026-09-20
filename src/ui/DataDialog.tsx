import { useState } from "react";
import { formatValue } from "../data/format";
import { SOURCE_GROUPS, createSource, kindsInGroup, sourceKind } from "../data/registry";
import { searchPlaces } from "../data/sources/weather";
import { fetchJson } from "../data/sources/shared";
import type { DataStore } from "../data/store";
import type { DataSource, ParamDef, SourceParams } from "../data/types";
import { Icon } from "./icons";
import { Button, Dialog, Disclosure, Field, Intro, Segmented, inputClass } from "./kit";

const ago = (at: number) => {
  if (!at) return "not yet";
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : "a while ago";
};

function PlaceField({ params, patch }: { params: SourceParams; patch: (p: SourceParams) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; name: string; lat: number; lon: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  const search = () =>
    run(async () => {
      if (!query.trim()) return;
      const found = await searchPlaces(query.trim());
      setResults(found);
      if (!found.length) setError("No town or city by that name.");
    });

  const detect = () =>
    run(async () => {
      const data = await fetchJson("https://get.geojs.io/v1/ip/geo.json");
      patch({ place: data.city || "My location", lat: String(data.latitude ?? ""), lon: String(data.longitude ?? "") });
      setResults(null);
    });

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[13px] text-white/75">Place</span>
        <span className="text-[12px] text-[var(--accent)]">{params.place || "Not set"}</span>
      </div>
      <div className="flex gap-1.5">
        <input
          className={inputClass}
          placeholder="Search a town or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button icon="search" title="Search" onClick={search} disabled={busy} />
        <Button icon="pin" title="Use my rough location" onClick={detect} disabled={busy} />
      </div>
      {error ? <p className="mt-1.5 text-[12px] text-red-300">{error}</p> : null}
      {results?.length ? (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-white/10">
          {results.map((r) => (
            <button
              key={`${r.lat},${r.lon}`}
              onClick={() => {
                patch({ place: r.name, lat: String(r.lat), lon: String(r.lon) });
                setResults(null);
                setQuery("");
              }}
              className="block w-full px-2.5 py-2 text-left text-[12.5px] text-white/80 transition hover:bg-white/10"
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
        Searching a place fills in the exact spot for you. Nothing leaves your browser except the weather request itself.
      </p>
    </div>
  );
}

function ParamField({
  def,
  params,
  patch,
}: {
  def: ParamDef;
  params: SourceParams;
  patch: (p: SourceParams) => void;
}) {
  const value = params[def.key] ?? def.default;

  if (def.kind === "place") return <PlaceField params={params} patch={patch} />;

  if (def.kind === "select") {
    const options = def.options ?? [];
    return (
      <Field label={def.label} help={def.hint} stacked={options.length > 3}>
        {options.length <= 3 ? (
          <Segmented
            size="sm"
            value={value}
            onChange={(v) => patch({ [def.key]: v })}
            options={options.map((o) => ({ value: o.value, label: o.label }))}
          />
        ) : (
          <select className={inputClass} value={value} onChange={(e) => patch({ [def.key]: e.target.value })}>
            {options.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#1b1928]">
                {o.label}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  }

  const preset = def.options?.find((o) => o.value === value);
  return (
    <Field label={def.label} help={def.hint} stacked>
      {def.options?.length ? (
        <select
          className={`${inputClass} mb-1.5`}
          value={preset ? value : "__custom"}
          onChange={(e) => e.target.value !== "__custom" && patch({ [def.key]: e.target.value })}
        >
          {def.options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1b1928]">
              {o.label}
            </option>
          ))}
          <option value="__custom" className="bg-[#1b1928]">
            Something else…
          </option>
        </select>
      ) : null}
      <input
        className={inputClass}
        type={def.kind === "number" ? "number" : "text"}
        placeholder={def.placeholder}
        value={value}
        onChange={(e) => patch({ [def.key]: e.target.value })}
      />
    </Field>
  );
}

function SourceCard({
  source,
  store,
  update,
  remove,
}: {
  source: DataSource;
  store: DataStore;
  update: (patch: Partial<DataSource>) => void;
  remove: () => void;
}) {
  const kind = sourceKind(source.kind);
  const state = store.states[source.id];
  if (!kind) return null;

  const dot =
    state?.status === "ok" ? "#7cf5c4" : state?.status === "error" ? "#ff7a7a" : "#ffd166";

  return (
    <div className="mb-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
          <Icon name={kind.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <input
            className="w-full bg-transparent text-[13.5px] font-semibold outline-none"
            value={source.name}
            aria-label="What this data is called"
            onChange={(e) => update({ name: e.target.value })}
          />
          <p className="flex items-center gap-1.5 text-[11.5px] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
            {state?.status === "error" ? state.error : `Updated ${ago(state?.fetchedAt ?? 0)}`}
          </p>
        </div>
        <Button icon="refresh" title="Update now" onClick={() => store.refresh(source.id)} className="px-2" />
        <Button
          variant="danger"
          icon="trash"
          title="Remove this data"
          className="px-2"
          onClick={() => confirm(`Remove “${source.name}”? Components using it will show dashes.`) && remove()}
        />
      </div>

      {kind.params.length ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          {kind.params.map((p) => (
            <ParamField
              key={p.key}
              def={p}
              params={source.params}
              patch={(patch) => update({ params: { ...source.params, ...patch } })}
            />
          ))}
        </div>
      ) : null}

      <Disclosure title={`What you can use from this (${kind.fields.length})`}>
        <div className="-mt-1 mb-2 grid gap-1">
          {kind.fields.map((f) => {
            const raw = state?.value?.[f.key];
            const shown = state?.value ? formatValue(raw, f.type, f.format) : "…";
            return (
              <div key={f.key} className="flex items-baseline justify-between gap-3 py-0.5 text-[12.5px]">
                <span className="text-white/65">{f.label}</span>
                <span className="truncate text-right font-medium text-white/90">
                  {f.type === "list" && Array.isArray(raw) ? `${raw.length} in the list` : shown}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mb-2 text-[12px] leading-relaxed text-white/45">
          Components can show any of these. Lists (like headlines or games) repeat a row for each item.
        </p>
      </Disclosure>
    </div>
  );
}

export function DataDialog({
  sources,
  setSources,
  store,
  onClose,
}: {
  sources: DataSource[];
  setSources: (next: DataSource[]) => void;
  store: DataStore;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(sources.length === 0);

  const add = (kind: string) => {
    const created = createSource(kind);
    if (!created) return;
    const taken = sources.filter((s) => s.kind === kind).length;
    setSources([...sources, { ...created, name: taken ? `${created.name} ${taken + 1}` : created.name }]);
    setAdding(false);
  };

  return (
    <Dialog
      title="Data"
      subtitle="Live information your components can show."
      icon="data"
      onClose={onClose}
      width={560}
    >
      <Intro>
        Add the weather, headlines, scores or the time once here, and any component on any page can show it. Everything
        updates by itself.
      </Intro>

      {sources.map((s) => (
        <SourceCard
          key={s.id}
          source={s}
          store={store}
          update={(patch) => setSources(sources.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))}
          remove={() => setSources(sources.filter((x) => x.id !== s.id))}
        />
      ))}

      {adding || sources.length === 0 ? (
        <div className="mt-1">
          {SOURCE_GROUPS.map((group) => {
            const kinds = kindsInGroup(group);
            if (!kinds.length) return null;
            return (
              <div key={group} className="mb-4">
                <p className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">{group}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {kinds.map((k) => (
                    <button
                      key={k.kind}
                      onClick={() => add(k.kind)}
                      className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition hover:border-[var(--accent)]/60 hover:bg-white/[0.07]"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                        <Icon name={k.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium">{k.label}</span>
                        <span className="block text-[12px] leading-snug text-white/50">{k.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Button variant="primary" icon="plus" className="w-full" onClick={() => setAdding(true)}>
          Add data
        </Button>
      )}
    </Dialog>
  );
}
