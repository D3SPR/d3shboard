import { useState, type ReactNode } from "react";
import { FONTS, effectiveStyle, rectFor } from "../lib/board";
import type { AnimationRule, BreakpointKey, IdleAnimation, Rect, RenderBoard, Screen, Widget, WidgetStyle } from "../lib/types";
import { formatDate, listLeafPaths } from "../lib/util";
import { catalogEntry } from "../widgets/catalog";
import { describeRule } from "./AnimationsDialog";
import { Icon, type IconName } from "./icons";
import { ACCENT_SWATCHES } from "./Toolbar";
import { Button, ColorField, Dialog, Disclosure, Field, Help, Intro, Section, Segmented, Slider, Toggle, inputClass } from "./kit";

type Tab = "content" | "look" | "position" | "motion";

type Props = {
  board: RenderBoard;
  bp: BreakpointKey;
  widget: Widget;
  screens: Screen[];
  onClose: () => void;
  update: (id: string, patch: Partial<Widget>) => void;
  updateRect: (id: string, patch: Partial<Rect>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  onEditAnimation: (ruleId: string) => void;
  onNewAnimation: (widgetId: string) => void;
  initialTab?: Tab;
};

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "content", label: "Content", icon: "text" },
  { id: "look", label: "Look", icon: "palette" },
  { id: "position", label: "Position", icon: "move" },
  { id: "motion", label: "Motion", icon: "sparkles" },
];

export function WidgetEditor(props: Props) {
  const { widget, board } = props;
  const [tab, setTab] = useState<Tab>(props.initialTab ?? "content");
  const entry = catalogEntry(widget.type);

  return (
    <Dialog
      onClose={props.onClose}
      width={460}
      header={
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
            <Icon name={entry.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <label className="flex items-center gap-1.5">
              <input
                className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none"
                value={widget.title}
                aria-label="Name"
                onChange={(e) => props.update(widget.id, { title: e.target.value })}
              />
              <Icon name="pencil" size={12} className="shrink-0 opacity-40" />
            </label>
            <p className="text-[12px] text-white/45">{entry.label}</p>
          </div>
        </div>
      }
      footer={
        <>
          <Button icon="copy" className="flex-1" onClick={() => props.duplicate(widget.id)}>
            Make a copy
          </Button>
          <Button
            variant="danger"
            icon="trash"
            className="flex-1"
            onClick={() => {
              if (!confirm(`Delete “${widget.title}”?`)) return;
              props.remove(widget.id);
              props.onClose();
            }}
          >
            Delete
          </Button>
        </>
      }
    >
      <div className="-mt-1 mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({
            value: t.id,
            label: (
              <>
                <Icon name={t.icon} size={14} />
                <span>{t.label}</span>
              </>
            ),
          }))}
        />
      </div>
      {tab === "content" ? <ContentTab {...props} /> : null}
      {tab === "look" ? <LookTab widget={widget} accent={board.accent} bp={props.bp} update={props.update} /> : null}
      {tab === "position" ? <PositionTab {...props} /> : null}
      {tab === "motion" ? <MotionTab {...props} /> : null}
    </Dialog>
  );
}

function PresetOrCustom({
  value,
  options,
  onChange,
  customPlaceholder,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  customPlaceholder?: string;
}) {
  const known = options.some((o) => o.value === value);
  const [custom, setCustom] = useState(!known);
  return (
    <div className="grid gap-2">
      <select
        className={inputClass}
        value={custom ? "__custom" : value}
        onChange={(e) => {
          if (e.target.value === "__custom") setCustom(true);
          else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value="__custom">Something else…</option>
      </select>
      {custom ? (
        <input className={inputClass} value={value} placeholder={customPlaceholder} onChange={(e) => onChange(e.target.value)} />
      ) : null}
    </div>
  );
}

const TIME_FORMATS = ["HH:mm:ss", "HH:mm", "h:mm A", "h:mm:ss A"];
const DATE_FORMATS = ["dddd, DD MMM YYYY", "ddd DD/MM/YYYY", "MMMM YYYY", "dddd", ""];
const TIMEZONES = [
  "UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Athens", "America/New_York",
  "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo", "Africa/Lagos",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];
const FEEDS = [
  { value: "https://feeds.bbci.co.uk/news/rss.xml", label: "BBC News — top stories" },
  { value: "https://feeds.bbci.co.uk/news/world/rss.xml", label: "BBC News — world" },
  { value: "https://feeds.bbci.co.uk/news/technology/rss.xml", label: "BBC News — technology" },
  { value: "https://hnrss.org/frontpage", label: "Hacker News — front page" },
  { value: "https://www.theverge.com/rss/index.xml", label: "The Verge" },
];

const TOKEN_HELP = (
  <>
    Letters are swapped for parts of the date: <b>HH</b> hour (24h), <b>h</b> hour (12h), <b>mm</b> minutes, <b>ss</b> seconds,
    <b> A</b> AM/PM, <b>dddd</b> day name, <b>ddd</b> short day, <b>DD</b> day number, <b>MMMM</b> month name, <b>MMM</b> short month,
    <b> MM</b> month number, <b>YYYY</b> year. Anything else shows as typed.
  </>
);

function ContentTab({ widget, update }: Props) {
  const cfg = widget.config;
  const set = (key: string, value: string | number) => update(widget.id, { config: { ...cfg, [key]: value } });
  const s = (key: string) => String(cfg[key] ?? "");
  const n = (key: string) => Number(cfg[key] ?? 0);
  const now = new Date();

  const known: Partial<Record<Widget["type"], string[]>> = {
    clock: ["format", "sub", "timezone"],
    text: ["text"],
    image: ["url", "fit"],
    iframe: ["url"],
    feed: ["url", "count", "refresh"],
    api: ["url", "path", "prefix", "suffix", "refresh"],
    embed: ["html"],
  };
  const extras = Object.entries(cfg).filter(([k]) => !(known[widget.type] ?? []).includes(k));

  let fields: ReactNode = null;
  switch (widget.type) {
    case "clock":
      fields = (
        <>
          <Field label="Time style" help={TOKEN_HELP} stacked>
            <PresetOrCustom
              value={s("format")}
              onChange={(v) => set("format", v)}
              customPlaceholder="e.g. HH:mm"
              options={TIME_FORMATS.map((f) => ({ value: f, label: formatDate(now, f) }))}
            />
          </Field>
          <Field label="Second line" help={TOKEN_HELP} stacked>
            <PresetOrCustom
              value={s("sub")}
              onChange={(v) => set("sub", v)}
              customPlaceholder="e.g. dddd DD MMMM"
              options={DATE_FORMATS.map((f) => ({ value: f, label: f ? formatDate(now, f) : "Nothing" }))}
            />
          </Field>
          <Field label="Time zone" help="Show the time somewhere else in the world. Leave on “My time” to use this device's clock." stacked>
            <PresetOrCustom
              value={s("timezone")}
              onChange={(v) => set("timezone", v)}
              customPlaceholder="e.g. Asia/Seoul"
              options={[{ value: "", label: "My time" }, ...TIMEZONES.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))]}
            />
          </Field>
        </>
      );
      break;
    case "text":
      fields = (
        <Field label="Your text" stacked>
          <textarea className={`${inputClass} h-36`} value={s("text")} onChange={(e) => set("text", e.target.value)} />
        </Field>
      );
      break;
    case "image":
      fields = (
        <>
          <Field label="Picture link" help="Find a picture online, right-click it and choose “Copy image address”, then paste it here." stacked>
            <input className={inputClass} placeholder="https://…" value={s("url")} onChange={(e) => set("url", e.target.value)} />
          </Field>
          <Field label="Sizing" stacked>
            <Segmented
              value={s("fit") || "cover"}
              onChange={(v) => set("fit", v)}
              options={[
                { value: "cover", label: "Fill the box", title: "Crops the edges so there's no empty space" },
                { value: "contain", label: "Show it all", title: "Shows the whole picture, may leave gaps" },
                { value: "fill", label: "Stretch", title: "Stretches to fit exactly" },
              ]}
            />
          </Field>
        </>
      );
      break;
    case "iframe":
      fields = (
        <Field
          label="Web address"
          help="Some websites (like Google or YouTube's main site) refuse to be shown inside other pages. If yours stays blank, that's why."
          stacked
        >
          <input className={inputClass} placeholder="https://…" value={s("url")} onChange={(e) => set("url", e.target.value)} />
        </Field>
      );
      break;
    case "feed":
      fields = (
        <>
          <Field label="News source" help="Any site with an RSS feed works. Look for an “RSS” link on a news site and paste it in with “Something else…”." stacked>
            <PresetOrCustom value={s("url")} onChange={(v) => set("url", v)} customPlaceholder="https://…/rss.xml" options={FEEDS} />
          </Field>
          <Field label="Headlines to show">
            <Slider value={n("count")} min={1} max={20} onChange={(v) => set("count", v)} label="Headlines to show" />
          </Field>
          <Field label="Check for news every" help="How often to look for new headlines.">
            <Slider value={n("refresh")} min={1} max={120} onChange={(v) => set("refresh", v)} unit="min" label="Check for news every" />
          </Field>
        </>
      );
      break;
    case "api":
      fields = <ApiFields widget={widget} set={set} />;
      break;
    case "embed":
      fields = (
        <Field
          label="HTML code"
          help="Runs in its own safe box, so it can't break the rest of your dashboard. Scripts are allowed."
          stacked
        >
          <textarea
            className={`${inputClass} h-48 font-['JetBrains_Mono'] text-[12px]`}
            spellCheck={false}
            value={s("html")}
            onChange={(e) => set("html", e.target.value)}
          />
        </Field>
      );
      break;
  }

  return (
    <>
      {fields}
      <Field label="Show name on top" help="Displays the name (at the top of this window) as a small heading inside the component.">
        <Toggle checked={widget.showTitle} onChange={(showTitle) => update(widget.id, { showTitle })} label="Show name on top" />
      </Field>
      {extras.length ? (
        <Disclosure title="Other settings">
          {extras.map(([key, value]) => (
            <Field key={key} label={key} stacked>
              <input
                className={inputClass}
                type={typeof value === "number" ? "number" : "text"}
                value={String(value)}
                onChange={(e) => set(key, typeof value === "number" ? Number(e.target.value) : e.target.value)}
              />
            </Field>
          ))}
        </Disclosure>
      ) : null}
    </>
  );
}

function ApiFields({ widget, set }: { widget: Widget; set: (k: string, v: string | number) => void }) {
  const cfg = widget.config;
  const [paths, setPaths] = useState<{ path: string; value: string }[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const explore = async () => {
    setStatus("loading");
    try {
      const data = await (await fetch(String(cfg.url))).json();
      setPaths(listLeafPaths(data));
      setStatus("idle");
    } catch {
      setPaths(null);
      setStatus("error");
    }
  };

  return (
    <>
      <Intro>Shows one live value — a price, a temperature, a score — from a data link (an “API”) that returns JSON.</Intro>
      <Field label="Data link" stacked>
        <input className={inputClass} placeholder="https://…" value={String(cfg.url ?? "")} onChange={(e) => set("url", e.target.value)} />
      </Field>
      <Field
        label="Which value"
        help="Data links return lots of values. This says which one to show, like an address: “bpi.USD.rate” means the “rate” inside “USD” inside “bpi”. Easiest: press “Look inside” and click the one you want."
        stacked
      >
        <div className="flex gap-2">
          <input className={inputClass} placeholder="e.g. bpi.USD.rate" value={String(cfg.path ?? "")} onChange={(e) => set("path", e.target.value)} />
          <Button className="shrink-0" onClick={explore}>
            {status === "loading" ? "Looking…" : "Look inside"}
          </Button>
        </div>
      </Field>
      {status === "error" ? (
        <p className="-mt-2 mb-3 text-[12px] text-red-300">Couldn't read that link. Check the address, or the site may not allow it.</p>
      ) : null}
      {paths ? (
        <div className="-mt-2 mb-4 max-h-48 overflow-y-auto rounded-lg border border-white/10">
          {paths.length === 0 ? <p className="p-2 text-[12px] text-white/50">No values found.</p> : null}
          {paths.map((p) => (
            <button
              key={p.path}
              onClick={() => {
                set("path", p.path);
                setPaths(null);
              }}
              className="flex w-full items-baseline justify-between gap-3 border-b border-white/5 px-2.5 py-1.5 text-left text-[12px] hover:bg-white/10"
            >
              <span className="truncate font-['JetBrains_Mono'] text-white/60">{p.path || "(whole value)"}</span>
              <span className="max-w-[45%] shrink-0 truncate font-medium">{p.value}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Text before" help="e.g. “$” or “Temp:”" stacked>
          <input className={inputClass} value={String(cfg.prefix ?? "")} onChange={(e) => set("prefix", e.target.value)} />
        </Field>
        <Field label="Text after" help="e.g. “°C” or “ users”" stacked>
          <input className={inputClass} value={String(cfg.suffix ?? "")} onChange={(e) => set("suffix", e.target.value)} />
        </Field>
      </div>
      <Field label="Update every">
        <Slider value={Number(cfg.refresh ?? 5)} min={1} max={120} onChange={(v) => set("refresh", v)} unit="min" label="Check again every" />
      </Field>
    </>
  );
}

const STYLE_PRESETS: { label: string; style: Partial<WidgetStyle> }[] = [
  { label: "Glass", style: { bg: "#15131fE6", fg: "#efedf7", border: "#ffffff1f", borderWidth: 1, radius: 18, padding: 18, shadow: "soft", blur: true } },
  { label: "Solid", style: { bg: "#221f31", fg: "#efedf7", border: "#00000000", borderWidth: 0, radius: 14, padding: 18, shadow: "soft", blur: false } },
  { label: "Outline", style: { bg: "#00000000", fg: "#efedf7", border: "#ffffff66", borderWidth: 2, radius: 14, padding: 16, shadow: "none", blur: false } },
  { label: "Bare", style: { bg: "#00000000", fg: "#ffffff", border: "#00000000", borderWidth: 0, radius: 0, padding: 6, shadow: "none", blur: false } },
  { label: "Paper", style: { bg: "#f5f1e8", fg: "#1b1a17", border: "#0000001a", borderWidth: 1, radius: 10, padding: 18, shadow: "soft", blur: false } },
  { label: "Loud", style: { bg: "#c7b8ff", fg: "#0b0a12", border: "#0b0a12", borderWidth: 2, radius: 22, padding: 18, shadow: "hard", blur: false, fontWeight: 700 } },
];

function AutoTag() {
  return (
    <span className="rounded bg-[var(--accent)]/15 px-1 py-px text-[9.5px] font-semibold tracking-wider text-[var(--accent)] uppercase">
      Auto
    </span>
  );
}

function LookTab({ widget, accent, bp, update }: { widget: Widget; accent: string; bp: BreakpointKey; update: Props["update"] }) {
  const st = widget.style;
  const set = (patch: Partial<WidgetStyle>) => update(widget.id, { style: { ...st, ...patch } });
  const auto = st.autoFit;
  const shown = effectiveStyle(widget, rectFor(widget, bp));

  return (
    <>
      <div
        className={`mb-5 flex items-center gap-3 rounded-xl border p-3 ${auto ? "border-[var(--accent)]/50 bg-[var(--accent)]/[0.07]" : "border-white/10"}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            Auto-fit to box
            <Help>
              Text size, the space inside and alignment follow the size of the box — drag its corners and everything grows or shrinks
              with it, centred. Each screen size fits separately. Turn this off to set them yourself; the component keeps its current
              look.
            </Help>
          </div>
          <p className="text-[12px] text-white/55">
            {auto
              ? `Right now: text ${Math.round(shown.fontSize)}px · spacing ${shown.padding}px · centred`
              : "Off — text size, spacing and alignment are set by hand below."}
          </p>
        </div>
        <Toggle
          checked={auto}
          label="Auto-fit to box"
          onChange={(on) =>
            on
              ? set({ autoFit: true })
              : set({ autoFit: false, fontSize: Math.round(shown.fontSize), padding: shown.padding, align: shown.align })
          }
        />
      </div>

      <Section title="Quick styles" hint="Start from a ready-made look, then fine-tune below.">
        <div className="grid grid-cols-3 gap-1.5">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => set(p.style)}
              className="h-11 text-[12px] font-medium transition hover:scale-[1.03]"
              style={{
                background: p.style.bg === "#00000000" ? "rgba(255,255,255,.03)" : p.style.bg,
                color: p.style.fg,
                border: `${p.style.borderWidth || 1}px ${p.style.borderWidth ? "solid" : "dashed"} ${p.style.borderWidth ? p.style.border : "#ffffff22"}`,
                borderRadius: Math.min(p.style.radius ?? 12, 14),
                boxShadow: p.style.shadow === "hard" ? "3px 3px 0 rgba(0,0,0,.55)" : undefined,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Colours">
        <Field label="Box colour" help="The slider next to the colour sets how see-through the box is — slide left for glassy.">
          <ColorField value={st.bg} onChange={(bg) => set({ bg })} withAlpha />
        </Field>
        <Field label="Text colour">
          <ColorField value={st.fg} onChange={(fg) => set({ fg })} swatches={["#ffffff", "#0b0a12", ...ACCENT_SWATCHES.slice(0, 4)]} />
        </Field>
        <Field label="Border colour">
          <ColorField value={st.border} onChange={(border) => set({ border })} withAlpha />
        </Field>
        <Disclosure title="Advanced: type any CSS colour">
          <Field label="Box" help="Accepts anything CSS does, e.g. “rgba(0,0,0,.4)” or “linear-gradient(90deg, red, blue)”." stacked>
            <input className={inputClass} value={st.bg} onChange={(e) => set({ bg: e.target.value })} />
          </Field>
          <Field label="Border" stacked>
            <input className={inputClass} value={st.border} onChange={(e) => set({ border: e.target.value })} />
          </Field>
        </Disclosure>
      </Section>

      <Section title="Shape">
        <Field label="Rounded corners">
          <Slider value={st.radius} min={0} max={60} onChange={(radius) => set({ radius })} unit="px" label="Rounded corners" />
        </Field>
        <Field label="Border thickness">
          <Slider value={st.borderWidth} min={0} max={12} onChange={(borderWidth) => set({ borderWidth })} unit="px" label="Border thickness" />
        </Field>
        <Field
          label={<span className="flex items-center gap-1.5">Space inside {auto ? <AutoTag /> : null}</span>}
          help={auto ? "Set automatically by Auto-fit. Turn Auto-fit off at the top to change it." : "Gap between the edge of the box and what's inside it."}
        >
          <Slider
            value={shown.padding}
            min={0}
            max={120}
            disabled={auto}
            onChange={(padding) => set({ padding })}
            unit="px"
            label="Space inside"
          />
        </Field>
      </Section>

      <Section title="Text" hint={auto ? "Size and alignment follow the box while Auto-fit is on." : undefined}>
        <Field label="Font" stacked>
          <select className={inputClass} value={st.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
            <option value="inherit">Same as the page</option>
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f === "system-ui" ? "Device default" : f}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={<span className="flex items-center gap-1.5">Size {auto ? <AutoTag /> : null}</span>}
          help={auto ? "Set automatically by Auto-fit. Turn Auto-fit off at the top to change it." : undefined}
        >
          <Slider
            value={shown.fontSize}
            min={6}
            max={240}
            disabled={auto}
            onChange={(fontSize) => set({ fontSize })}
            unit="px"
            label="Size"
          />
        </Field>
        <Field label="Boldness">
          <Slider value={st.fontWeight} min={100} max={900} step={100} onChange={(fontWeight) => set({ fontWeight })} label="Thickness" />
        </Field>
        <Field label="Letter spacing">
          <Slider value={st.letterSpacing} min={-3} max={12} onChange={(letterSpacing) => set({ letterSpacing })} unit="px" label="Letter spacing" />
        </Field>
        <Field label={<span className="flex items-center gap-1.5">Line up text {auto ? <AutoTag /> : null}</span>} stacked>
          <Segmented
            disabled={auto}
            value={shown.align}
            onChange={(align) => set({ align })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Middle" },
              { value: "right", label: "Right" },
            ]}
          />
        </Field>
      </Section>

      <Section title="Effects">
        <Field label="Shadow" stacked>
          <Segmented
            value={st.shadow}
            onChange={(shadow) => set({ shadow })}
            options={[
              { value: "none", label: "None" },
              { value: "soft", label: "Soft" },
              { value: "hard", label: "Hard", title: "A solid, cartoon-style offset shadow" },
              { value: "glow", label: "Glow", title: `A glow in your highlight colour (${accent})` },
            ]}
          />
        </Field>
        <Field label="Frosted glass" help="Blurs whatever is behind the box. Most visible when the box colour is see-through.">
          <Toggle checked={st.blur} onChange={(blur) => set({ blur })} label="Frosted glass" />
        </Field>
        <Field label="Fade whole thing" help="Makes the entire component, including its text, partly see-through.">
          <Slider value={Math.round(st.opacity * 100)} min={10} max={100} step={5} onChange={(v) => set({ opacity: v / 100 })} unit="%" label="See-through" />
        </Field>
      </Section>
    </>
  );
}

function PositionTab({ widget, board, bp, screens, update, updateRect }: Props) {
  const rect = rectFor(widget, bp);
  const bpLabel = (screens.find((b) => b.key === bp) ?? screens[screens.length - 1]).label.toLowerCase();
  const num = (key: keyof Rect, label: string) => (
    <label className="text-[12.5px]">
      <span className="mb-1 block text-white/60">{label}</span>
      <input
        type="number"
        className={inputClass}
        value={Number(rect[key])}
        onChange={(e) => updateRect(widget.id, { [key]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <>
      <Intro>
        You can also just drag the component around and pull its corner dots. These numbers are for the <b>{bpLabel}</b> layout —
        switch screen size in the toolbar to arrange other devices.
      </Intro>
      <div className="mb-5 grid grid-cols-2 gap-2">
        {num("x", "From left (px)")}
        {num("y", "From top (px)")}
        {num("w", "Width (px)")}
        {num("h", "Height (px)")}
      </div>

      <Section title="Layering" hint="When components overlap, the one in front covers the others.">
        <div className="flex gap-2">
          <Button icon="layers" className="flex-1" onClick={() => update(widget.id, { z: Math.max(...board.widgets.map((w) => w.z)) + 1 })}>
            Bring to front
          </Button>
          <Button className="flex-1" onClick={() => update(widget.id, { z: Math.min(...board.widgets.map((w) => w.z)) - 1 })}>
            Send to back
          </Button>
        </div>
      </Section>

      <Section title="Options">
        <Field label={`Hide on ${bpLabel}`} help={`Hides this only on the ${bpLabel} layout. It still shows on other screen sizes.`}>
          <Toggle checked={rect.hidden} onChange={(hidden) => updateRect(widget.id, { hidden })} label={`Hide on ${bpLabel}`} />
        </Field>
        <Field label="Lock in place" help="Stops it being moved or resized by accident. You can still edit it.">
          <Toggle checked={widget.locked} onChange={(locked) => update(widget.id, { locked })} label="Lock in place" />
        </Field>
        <Button
          className="mt-1 w-full"
          onClick={() => update(widget.id, { layouts: { sm: { ...rect }, md: { ...rect }, lg: { ...rect } } })}
        >
          Use this position on every screen size
        </Button>
      </Section>
    </>
  );
}

function MotionTab({ widget, board, update, onEditAnimation, onNewAnimation }: Props) {
  const related = board.animations.filter(
    (a: AnimationRule) => a.target.widgetId === widget.id || ("widgetId" in a.trigger && a.trigger.widgetId === widget.id),
  );
  return (
    <>
      <Section title="Gentle idle motion" hint="A slow, never-ending movement that plays while your dashboard is showing.">
        <Segmented<IdleAnimation>
          size="sm"
          value={widget.style.animation}
          onChange={(animation) => update(widget.id, { style: { ...widget.style, animation } })}
          options={[
            { value: "none", label: "Still" },
            { value: "float", label: "Float" },
            { value: "pulse", label: "Pulse" },
            { value: "fade", label: "Fade" },
            { value: "slide", label: "Sway" },
          ]}
        />
      </Section>

      <Section
        title="Animations"
        hint="Make this move when something happens — when it's tapped, when a value changes, at a certain time, and more."
      >
        {related.length === 0 ? <p className="mb-3 text-[12.5px] text-white/40">None yet.</p> : null}
        {related.map((rule) => (
          <button
            key={rule.id}
            onClick={() => onEditAnimation(rule.id)}
            className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-white/10 p-2.5 text-left hover:bg-white/10"
          >
            <Icon name="sparkles" className="shrink-0 text-[var(--accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{rule.name}</span>
              <span className="block truncate text-[12px] text-white/50">{describeRule(rule, board.widgets)}</span>
            </span>
            {!rule.enabled ? <span className="text-[11px] text-white/40">Off</span> : null}
            <Icon name="right" className="shrink-0 opacity-50" />
          </button>
        ))}
        <Button variant="primary" icon="plus" className="w-full" onClick={() => onNewAnimation(widget.id)}>
          Add an animation
        </Button>
      </Section>
    </>
  );
}
