import { useEffect, useRef, type ReactNode } from "react";
import { BRAND } from "../brand";
import { BREAKPOINTS, FONTS } from "../lib/board";
import type { Background, BreakpointKey, Panel, RenderBoard, WidgetType } from "../lib/types";
import type { BridgeStatus } from "../bridge/useAgentBridge";
import { PALETTE_SHORTCUT } from "../commands/shortcut";
import { WIDGET_CATALOG } from "../widgets/catalog";
import { Icon, Logo, type IconName } from "./icons";
import { Button, ColorField, Disclosure, Field, Intro, Popover, Section, Segmented, Slider, Toggle, inputClass } from "./kit";

export type MenuId = "add" | "theme" | "screen" | "pages" | "file";

export const NAMED_ACCENTS = [
  { name: "Lavender", color: "#c7b8ff" },
  { name: "Mint", color: "#7cf5c4" },
  { name: "Pink", color: "#ff8fc7" },
  { name: "Gold", color: "#ffd166" },
  { name: "Sky", color: "#6ec3ff" },
  { name: "Coral", color: "#ff7a59" },
  { name: "White", color: "#ffffff" },
];

export const ACCENT_SWATCHES = NAMED_ACCENTS.map((a) => a.color);

export const BACKGROUND_PRESETS: { label: string; bg: Partial<Background>; light?: boolean }[] = [
  { label: "Midnight", bg: { kind: "gradient", color: "#0b0a12", color2: "#221a3a", angle: 145 } },
  { label: "Ocean", bg: { kind: "gradient", color: "#04131f", color2: "#0d4a63", angle: 160 } },
  { label: "Sunset", bg: { kind: "gradient", color: "#2a0f2e", color2: "#8a3b3b", angle: 135 } },
  { label: "Forest", bg: { kind: "gradient", color: "#07140e", color2: "#1f4d33", angle: 150 } },
  { label: "Graphite", bg: { kind: "solid", color: "#121216" } },
  { label: "Paper", bg: { kind: "solid", color: "#e9e4da" }, light: true },
];

const bgPreview = (b: Partial<Background>) =>
  b.kind === "gradient" ? `linear-gradient(${b.angle}deg, ${b.color}, ${b.color2})` : b.color;

type Props = {
  board: RenderBoard;
  bp: BreakpointKey;
  setBp: (bp: BreakpointKey) => void;
  setBoard: (patch: Partial<Panel>) => void;
  addType: (type: WidgetType) => void;
  panels: Panel[];
  activePanelId: string;
  selectPanel: (id: string) => void;
  addPanel: () => void;
  renamePanel: (id: string, name: string) => void;
  duplicatePanel: (id: string) => void;
  deletePanel: (id: string) => void;
  movePanel: (id: string, dir: -1 | 1) => void;
  onAutomations: () => void;
  onAnimations: () => void;
  onExport: () => void;
  onImport: () => void;
  onReset: () => void;
  onHelp: () => void;
  onTemplates: () => void;
  onAgent: () => void;
  agentStatus: BridgeStatus;
  onCommands: () => void;
  openMenu: MenuId | null;
  setOpenMenu: (id: MenuId | null | ((cur: MenuId | null) => MenuId | null)) => void;
  onDone: () => void;
};

function ToolButton({
  icon,
  label,
  active,
  onClick,
  buttonRef,
  title,
  dot,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onClick: () => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  title?: string;
  dot?: string;
}) {
  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      title={title ?? label}
      aria-expanded={active}
      className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] transition ${active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
    >
      <Icon name={icon} size={16} />
      <span className="hidden sm:inline">{label}</span>
      {dot ? <span className="absolute top-1 left-5 h-2 w-2 rounded-full ring-2 ring-[var(--chrome)]" style={{ background: dot }} /> : null}
    </button>
  );
}

export function Toolbar(props: Props) {
  const { board, bp, openMenu: open, setOpenMenu: setOpen } = props;
  const headerRef = useRef<HTMLElement>(null);
  const anchors = {
    add: useRef<HTMLButtonElement>(null),
    theme: useRef<HTMLButtonElement>(null),
    screen: useRef<HTMLButtonElement>(null),
    pages: useRef<HTMLButtonElement>(null),
    file: useRef<HTMLButtonElement>(null),
  };

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (headerRef.current?.contains(t) || t.closest?.("[data-popover]")) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggle = (id: MenuId) => setOpen((cur) => (cur === id ? null : id));
  const close = () => setOpen(null);
  const bpInfo = BREAKPOINTS.find((b) => b.key === bp)!;
  const bpIcon: IconName = bp === "sm" ? "phone" : bp === "md" ? "tablet" : "computer";

  return (
    <header
      ref={headerRef}
      className="relative z-30 flex h-13 shrink-0 items-center gap-1 border-b border-white/10 bg-[var(--chrome)] px-2 text-white sm:px-3"
    >
      <div className="mr-2 flex shrink-0 items-center gap-2" title={BRAND.tagline}>
        <Logo />
        <span className="hidden font-['Unbounded'] text-[14px] font-semibold tracking-tight lg:inline">
          {BRAND.name}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
        <ToolButton icon="plus" label="Add" active={open === "add"} onClick={() => toggle("add")} buttonRef={anchors.add} title="Add something to this page" />
        <ToolButton icon="palette" label="Theme" active={open === "theme"} onClick={() => toggle("theme")} buttonRef={anchors.theme} title="Colours, font and background" />
        <ToolButton icon={bpIcon} label={bpInfo.label} active={open === "screen"} onClick={() => toggle("screen")} buttonRef={anchors.screen} title="Choose which screen size you're arranging" />
        <ToolButton icon="pages" label="Pages" active={open === "pages"} onClick={() => toggle("pages")} buttonRef={anchors.pages} title="Add or switch between pages" />
        <ToolButton icon="sparkles" label="Animate" onClick={() => { close(); props.onAnimations(); }} title="Make things move" />
        <ToolButton icon="zap" label="Automations" onClick={() => { close(); props.onAutomations(); }} title="Change things automatically, e.g. at night" />
        <ToolButton icon="save" label="Backup" active={open === "file"} onClick={() => toggle("file")} buttonRef={anchors.file} title="Save a copy, load one, or start over" />
        <ToolButton
          icon="bot"
          label="Agent"
          onClick={() => { close(); props.onAgent(); }}
          title="Let an AI agent build your dashboard"
          dot={
            props.agentStatus === "connected"
              ? "#7cf5c4"
              : props.agentStatus === "waiting" || props.agentStatus === "connecting"
                ? "#ffd166"
                : props.agentStatus === "rejected"
                  ? "#ff7a7a"
                  : undefined
          }
        />
        <ToolButton icon="help" label="Help" onClick={() => { close(); props.onHelp(); }} title="How does this work?" />
      </div>

      <button
        onClick={() => { close(); props.onCommands(); }}
        title={`Command palette (${PALETTE_SHORTCUT})`}
        aria-label="Open command palette"
        className="ml-1 hidden shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[12px] text-white/60 transition hover:bg-white/10 hover:text-white sm:flex"
      >
        <Icon name="search" size={14} />
        <kbd className="font-sans">{PALETTE_SHORTCUT}</kbd>
      </button>

      <button
        onClick={props.onDone}
        title="Finish editing and see your dashboard"
        className="ml-2 flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-semibold text-[var(--accent-ink)] transition hover:brightness-110"
      >
        <Icon name="eye" size={16} />
        Done
      </button>

      <Popover anchor={anchors.add} open={open === "add"} width={300}>
        <AddMenu onAdd={(t) => { props.addType(t); close(); }} />
      </Popover>
      <Popover anchor={anchors.theme} open={open === "theme"} width={320}>
        <ThemeMenu board={board} setBoard={props.setBoard} />
      </Popover>
      <Popover anchor={anchors.screen} open={open === "screen"} width={290}>
        <ScreenMenu bp={bp} onPick={(k) => { props.setBp(k); close(); }} />
      </Popover>
      <Popover anchor={anchors.pages} open={open === "pages"} width={320}>
        <PagesMenu {...props} close={close} />
      </Popover>
      <Popover anchor={anchors.file} open={open === "file"} width={290}>
        <BackupMenu
          onExport={() => { props.onExport(); close(); }}
          onImport={() => { props.onImport(); close(); }}
          onReset={() => { props.onReset(); close(); }}
        />
      </Popover>
    </header>
  );
}

function AddMenu({ onAdd }: { onAdd: (type: WidgetType) => void }) {
  return (
    <>
      <Intro>Pick something to put on this page. Tap it to add it, or drag it to exactly where you want it.</Intro>
      {WIDGET_CATALOG.map((item) => (
        <button
          key={item.type}
          draggable
          onDragStart={(e) => e.dataTransfer.setData("widget/type", item.type)}
          onClick={() => onAdd(item.type)}
          className="mb-1.5 flex w-full cursor-grab items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition hover:border-[var(--accent)]/60 hover:bg-white/[0.07]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
            <Icon name={item.icon} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">{item.label}</span>
            <span className="block text-[12px] leading-snug text-white/50">{item.description}</span>
          </span>
        </button>
      ))}
    </>
  );
}

function ThemeMenu({ board, setBoard }: { board: RenderBoard; setBoard: (patch: Partial<Panel>) => void }) {
  const bg = board.background;
  const setBg = (patch: Partial<Background>) => setBoard({ background: { ...bg, ...patch } });
  return (
    <>
      <Intro>How this page looks. Changes apply to the page you're on.</Intro>

      <Section title="Highlight colour" hint="Used for buttons, outlines and glowing effects.">
        <ColorField value={board.accent} onChange={(accent) => setBoard({ accent })} swatches={ACCENT_SWATCHES} />
      </Section>

      <Section title="Font" hint="The lettering used across the page. Each component can override it.">
        <div className="grid grid-cols-2 gap-1.5">
          {FONTS.map((f) => (
            <button
              key={f}
              onClick={() => setBoard({ fontFamily: f })}
              className={`rounded-lg border px-2 py-2 text-left text-[13px] transition ${board.fontFamily === f ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10 hover:bg-white/10"}`}
              style={{ fontFamily: `"${f}", system-ui` }}
            >
              {f === "system-ui" ? "Device default" : f}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Background">
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {BACKGROUND_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setBg(p.bg)}
              className="flex h-12 items-end rounded-lg border border-white/10 p-1.5 text-[10.5px] transition hover:border-white/40"
              style={{
                background: bgPreview(p.bg),
                color: p.light ? "#1b1a17" : "rgba(255,255,255,.85)",
                textShadow: p.light ? undefined : "0 1px 2px #000",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mb-3">
          <Segmented
            value={bg.kind}
            onChange={(kind) => setBg({ kind })}
            options={[
              { value: "solid", label: "Colour" },
              { value: "gradient", label: "Blend" },
              { value: "image", label: "Picture" },
            ]}
          />
        </div>
        {bg.kind === "image" ? (
          <>
            <Field label="Picture link" help="Find a picture online, right-click it and choose “Copy image address”, then paste it here." stacked>
              <input className={inputClass} placeholder="https://…" value={bg.imageUrl} onChange={(e) => setBg({ imageUrl: e.target.value })} />
            </Field>
            <Field label="Sizing" stacked>
              <Segmented
                size="sm"
                value={bg.imageFit}
                onChange={(imageFit) => setBg({ imageFit })}
                options={[
                  { value: "cover", label: "Fill", title: "Fill the screen, cropping edges if needed" },
                  { value: "contain", label: "Fit", title: "Show the whole picture" },
                  { value: "repeat", label: "Tile", title: "Repeat like wallpaper" },
                ]}
              />
            </Field>
          </>
        ) : null}
        <Field label={bg.kind === "gradient" ? "First colour" : bg.kind === "image" ? "Colour behind picture" : "Colour"}>
          <ColorField value={bg.color} onChange={(color) => setBg({ color })} />
        </Field>
        {bg.kind === "gradient" ? (
          <>
            <Field label="Second colour">
              <ColorField value={bg.color2} onChange={(color2) => setBg({ color2 })} />
            </Field>
            <Field label="Direction" help="Which way the two colours blend into each other.">
              <Slider value={bg.angle} min={0} max={360} onChange={(angle) => setBg({ angle })} format={(v) => `${v}°`} />
            </Field>
          </>
        ) : null}
        <Field label="Darken" help="Puts a dark layer over the background so text on top is easier to read. Handy with busy pictures.">
          <Slider value={bg.dim} min={0} max={0.8} step={0.05} onChange={(dim) => setBg({ dim })} format={(v) => `${Math.round(v * 100)}%`} />
        </Field>
      </Section>

      <Disclosure title="Grid — helps line things up">
        <Field label="Snap to grid" help="When on, things you move or resize jump neatly into line instead of stopping anywhere.">
          <Toggle checked={board.snap} onChange={(snap) => setBoard({ snap })} label="Snap to grid" />
        </Field>
        <Field label="Show grid dots" help="Shows faint dots while editing. They never appear on your finished dashboard.">
          <Toggle checked={board.showGrid} onChange={(showGrid) => setBoard({ showGrid })} label="Show grid dots" />
        </Field>
        <Field label="Spacing" help="Distance between grid dots. Smaller = finer control.">
          <Slider value={board.gridSize} min={5} max={80} onChange={(gridSize) => setBoard({ gridSize })} format={(v) => `${v}px`} />
        </Field>
      </Disclosure>
    </>
  );
}

function ScreenMenu({ bp, onPick }: { bp: BreakpointKey; onPick: (k: BreakpointKey) => void }) {
  const icons: Record<BreakpointKey, IconName> = { sm: "phone", md: "tablet", lg: "computer" };
  return (
    <>
      <Intro>
        Your dashboard can be arranged differently on a phone, tablet and computer. Pick which one you're arranging right now.
      </Intro>
      {BREAKPOINTS.map((b) => (
        <button
          key={b.key}
          onClick={() => onPick(b.key)}
          className={`mb-1.5 flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition hover:bg-white/10 ${bp === b.key ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10"}`}
        >
          <Icon name={icons[b.key]} size={20} />
          <span>
            <span className="block text-[13px] font-medium">{b.label}</span>
            <span className="block text-[12px] text-white/50">About {b.width}px wide</span>
          </span>
        </button>
      ))}
      <p className="mt-2 text-[12px] leading-relaxed text-white/45">
        Moving or resizing only affects the screen size picked here. What's inside each component and how it looks stays the same everywhere.
      </p>
    </>
  );
}

function PagesMenu(props: Props & { close: () => void }) {
  const { panels, activePanelId } = props;
  return (
    <>
      <Intro>Pages are separate screens in your dashboard. When viewing, swipe or use the arrow keys to flip between them.</Intro>
      <Button
        icon="sparkles"
        className="mb-3 w-full"
        onClick={() => {
          props.close();
          props.onTemplates();
        }}
      >
        Start from a template
      </Button>
      {panels.map((p, i) => {
        const active = p.id === activePanelId;
        return (
          <div
            key={p.id}
            className={`mb-2 rounded-xl border p-2 ${active ? "border-[var(--accent)] bg-[var(--accent)]/[0.07]" : "border-white/10"}`}
          >
            <div className="flex items-center gap-1">
              <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 focus-within:bg-white/[0.06]">
                <Icon name="pencil" size={12} className="shrink-0 opacity-40" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none"
                  value={p.name}
                  aria-label="Page name"
                  onChange={(e) => props.renamePanel(p.id, e.target.value)}
                />
              </label>
              {active ? <span className="shrink-0 text-[11px] text-[var(--accent)]">Showing</span> : null}
            </div>
            <div className="mt-1.5 flex gap-1">
              {!active ? (
                <Button className="flex-1 py-1.5 text-[12px]" onClick={() => { props.selectPanel(p.id); props.close(); }}>
                  Open
                </Button>
              ) : null}
              <Button className="flex-1 py-1.5 text-[12px]" icon="copy" onClick={() => props.duplicatePanel(p.id)}>
                Copy
              </Button>
              <Button className="px-2 py-1.5" icon="left" title="Move earlier" disabled={i === 0} onClick={() => props.movePanel(p.id, -1)} />
              <Button className="px-2 py-1.5" icon="right" title="Move later" disabled={i === panels.length - 1} onClick={() => props.movePanel(p.id, 1)} />
              {panels.length > 1 ? (
                <Button
                  variant="danger"
                  className="px-2 py-1.5"
                  icon="trash"
                  title="Delete page"
                  onClick={() => confirm(`Delete “${p.name}” and everything on it?`) && props.deletePanel(p.id)}
                />
              ) : null}
            </div>
          </div>
        );
      })}
      <Button variant="primary" icon="plus" className="w-full" onClick={() => { props.addPanel(); props.close(); }}>
        New page
      </Button>
    </>
  );
}

function BackupMenu({ onExport, onImport, onReset }: { onExport: () => void; onImport: () => void; onReset: () => void }) {
  const Row = ({ icon, title, text, onClick, danger }: { icon: IconName; title: string; text: ReactNode; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      className={`mb-1.5 flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition ${danger ? "border-red-400/20 hover:bg-red-500/10" : "border-white/10 hover:bg-white/10"}`}
    >
      <span className={`mt-0.5 ${danger ? "text-red-300" : "text-[var(--accent)]"}`}>
        <Icon name={icon} />
      </span>
      <span>
        <span className={`block text-[13px] font-medium ${danger ? "text-red-200" : ""}`}>{title}</span>
        <span className="block text-[12px] leading-snug text-white/50">{text}</span>
      </span>
    </button>
  );
  return (
    <>
      <Intro>Everything saves automatically in this browser. Use a backup to keep a copy safe or move your dashboard to another device.</Intro>
      <Row icon="save" title="Download a backup" text="Saves your whole dashboard as a small file." onClick={onExport} />
      <Row icon="copy" title="Load a backup" text="Replaces this dashboard with one from a backup file." onClick={onImport} />
      <Row icon="trash" title="Start over" text="Wipes everything and goes back to the starter dashboard." onClick={onReset} danger />
    </>
  );
}
