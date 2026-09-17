import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { GROUP_ORDER, type Command } from "../commands/buildCommands";
import { PALETTE_SHORTCUT, PALETTE_SHORTCUT_ALT } from "../commands/shortcut";
import { Icon } from "./icons";

const RECENT_KEY = "d3shboard.recentCommands";
const MAX_RECENT = 5;
const MAX_RESULTS = 60;

const readRecent = (): string[] => {
  try {
    const ids = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

const rememberRecent = (id: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((r) => r !== id)].slice(0, MAX_RECENT)));
  } catch {
    // Recents are a convenience only.
  }
};

function score(cmd: Command, query: string): number | null {
  const label = cmd.label.toLowerCase();
  if (label.startsWith(query)) return 1000 - label.length;
  if (label.split(/[\s:“”"'()—-]+/).some((word) => word.startsWith(query))) return 800 - label.length;
  const at = label.indexOf(query);
  if (at >= 0) return 600 - at;
  const haystack = `${label} ${cmd.group} ${cmd.keywords ?? ""} ${cmd.detail ?? ""}`.toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);
  if (tokens.every((t) => haystack.includes(t))) return 400 - label.length;
  const compact = query.replace(/\s+/g, "");
  let i = 0;
  for (const ch of label) if (ch === compact[i]) i++;
  return i === compact.length ? 100 - label.length / 10 : null;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-[var(--accent)]/25 text-inherit">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

type Row = { key: string; cmd: Command; group: string };

type Props = {
  commands: Command[];
  onClose: () => void;
  onRun: (cmd: Command, value?: string) => void;
};

export function CommandPalette({ commands, onClose, onRun }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [prompt, setPrompt] = useState<{ cmd: Command; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const normalized = query.trim().toLowerCase();

  const rows: Row[] = useMemo(() => {
    if (!normalized) {
      const byId = new Map(commands.map((c) => [c.id, c]));
      const recent = readRecent()
        .map((id) => byId.get(id))
        .filter((c): c is Command => !!c)
        .map((cmd) => ({ key: `recent.${cmd.id}`, cmd, group: "Recently used" }));
      const grouped = GROUP_ORDER.flatMap((group) =>
        commands.filter((c) => c.group === group).map((cmd) => ({ key: cmd.id, cmd, group })),
      );
      return [...recent, ...grouped];
    }
    const recent = readRecent();
    return commands
      .map((cmd) => {
        const s = score(cmd, normalized);
        if (s === null) return { cmd, s };
        // A selection is strong intent: "dup" with a component selected should duplicate it, not the page.
        const contextBoost = cmd.group === "Selected component" ? 150 : 0;
        const recentIndex = recent.indexOf(cmd.id);
        const recentBoost = recentIndex >= 0 ? 40 - recentIndex * 5 : 0;
        return { cmd, s: s + contextBoost + recentBoost };
      })
      .filter((r): r is { cmd: Command; s: number } => r.s !== null)
      .sort((x, y) => y.s - x.s)
      .slice(0, MAX_RESULTS)
      .map(({ cmd }) => ({ key: cmd.id, cmd, group: "" }));
  }, [commands, normalized]);

  useEffect(() => setActive(0), [normalized]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (row: Row | undefined) => {
    if (!row) return;
    rememberRecent(row.cmd.id);
    if (row.cmd.prompt) {
      setPrompt({ cmd: row.cmd, value: row.cmd.prompt.initial ?? "" });
      requestAnimationFrame(() => inputRef.current?.select());
      return;
    }
    onRun(row.cmd);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (prompt) {
        setPrompt(null);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else onClose();
      return;
    }
    if (prompt) {
      if (e.key === "Enter") {
        e.preventDefault();
        onRun(prompt.cmd, prompt.value);
      }
      return;
    }
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 8));
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 8));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(rows[active]);
    } else if (e.key === "Tab") {
      e.preventDefault();
    }
  };

  const activeRow = rows[active];

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12dvh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Command palette"
        className="relative flex max-h-[70dvh] w-full max-w-[580px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--chrome)] text-white shadow-2xl shadow-black/70"
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4">
          {prompt ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--accent)]/15 px-2 py-1 text-[12px] text-[var(--accent)]">
              <Icon name={prompt.cmd.icon} size={13} />
              {prompt.cmd.label.replace(/…$/, "")}
            </span>
          ) : (
            <Icon name="search" size={17} className="shrink-0 text-white/40" />
          )}
          <input
            ref={inputRef}
            value={prompt ? prompt.value : query}
            onChange={(e) => (prompt ? setPrompt({ ...prompt, value: e.target.value }) : setQuery(e.target.value))}
            onKeyDown={onKeyDown}
            placeholder={prompt ? prompt.cmd.prompt!.placeholder : "Type a command — add, theme, page, animate…"}
            className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-white/35"
            role="combobox"
            aria-expanded={!prompt}
            aria-controls={listId}
            aria-activedescendant={!prompt && activeRow ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {prompt ? null : (
          <div ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-white/45">No commands match “{query.trim()}”.</p>
            ) : null}
            {rows.map((row, i) => {
              const showHeader = row.group && row.group !== rows[i - 1]?.group;
              const isActive = i === active;
              return (
                <Fragment key={row.key}>
                  {showHeader ? (
                    <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.14em] text-white/35 uppercase" role="presentation">
                      {row.group}
                    </div>
                  ) : null}
                  <div
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isActive}
                    onMouseMove={() => !isActive && setActive(i)}
                    onClick={() => choose(row)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] ${isActive ? "bg-white/10" : ""}`}
                  >
                    <Icon name={row.cmd.icon} size={16} className={`shrink-0 ${isActive ? "text-[var(--accent)]" : "text-white/45"}`} />
                    <span className="min-w-0 flex-1 truncate">
                      <Highlight text={row.cmd.label} query={normalized} />
                    </span>
                    {!row.group ? <span className="shrink-0 text-[11px] text-white/30">{row.cmd.group}</span> : null}
                    {row.cmd.detail ? (
                      <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/50">{row.cmd.detail}</span>
                    ) : null}
                    {isActive ? <Icon name="enter" size={14} className="shrink-0 text-white/40" /> : null}
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-2 text-[11.5px] text-white/40">
          {prompt ? (
            <>
              <span>
                <kbd className="text-white/60">↵</kbd> save
              </span>
              <span>
                <kbd className="text-white/60">esc</kbd> back
              </span>
            </>
          ) : (
            <>
              <span>
                <kbd className="text-white/60">↑↓</kbd> move
              </span>
              <span>
                <kbd className="text-white/60">↵</kbd> run
              </span>
              <span>
                <kbd className="text-white/60">esc</kbd> close
              </span>
            </>
          )}
          <span className="ml-auto hidden sm:inline">
            {PALETTE_SHORTCUT} or {PALETTE_SHORTCUT_ALT}
          </span>
        </div>
      </div>
    </div>
  );
}
