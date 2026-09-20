import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";

export const inputClass =
  "w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[var(--accent)]";

type Placement = { top: number; left: number; width: number };

function useAnchoredPosition(open: boolean, anchor: React.RefObject<HTMLElement | null>, width: number) {
  const [pos, setPos] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      setPos({ top: r.bottom + 8, left, width: w });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchor, width]);
  return pos;
}

export function Help({ children, label = "What does this mean?" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const pos = useAnchoredPosition(open, ref, 260);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border border-white/25 text-[10px] leading-none text-white/60 hover:border-white/60 hover:text-white"
      >
        ?
      </button>
      {open && pos
        ? createPortal(
            <div
              id={id}
              role="tooltip"
              className="pointer-events-none fixed z-[100] rounded-lg border border-white/10 bg-[#1b1928] px-3 py-2 text-[12px] leading-relaxed text-white/85 shadow-xl shadow-black/60"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function Field({
  label,
  help,
  children,
  stacked,
}: {
  label: ReactNode;
  help?: ReactNode;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={stacked ? "mb-4" : "mb-3 flex items-center justify-between gap-3"}>
      <div className={`flex shrink-0 items-center gap-1.5 text-[13px] text-white/75 ${stacked ? "mb-1.5" : ""}`}>
        <span>{label}</span>
        {help ? <Help>{help}</Help> : null}
      </div>
      <div className={stacked ? "" : "flex min-w-0 flex-1 justify-end"}>{children}</div>
    </div>
  );
}

export function Intro({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[12.5px] leading-relaxed text-white/55">{children}</p>;
}

export function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-white/45 uppercase">{title}</h3>
      {hint ? <p className="mb-2.5 text-[12px] leading-relaxed text-white/45">{hint}</p> : <div className="mb-2.5" />}
      {children}
    </section>
  );
}

export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 rounded-xl border border-white/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] text-white/80"
        aria-expanded={open}
      >
        {title}
        <Icon name="down" className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="border-t border-white/10 px-3 pt-3 pb-1">{children}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  disabled,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex w-full rounded-lg bg-white/[0.06] p-0.5 ${disabled ? "pointer-events-none opacity-40" : ""}`}
      role="radiogroup"
      aria-disabled={disabled || undefined}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 ${size === "sm" ? "py-1 text-[11.5px]" : "py-1.5 text-[12.5px]"} transition ${active ? "bg-[var(--accent)] font-medium text-[var(--accent-ink)]" : "text-white/70 hover:bg-white/10"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-[var(--accent)]" : "bg-white/15"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

/**
 * A slider with the number beside it as a box you can type into, because dragging
 * to an exact value is miserable. Typing is only applied once it parses and fits
 * the range, so half-typed numbers (like "-" or "1" on a 10–100 slider) don't jump.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  label,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  label?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value * 1000) / 1000);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const commit = () => {
    const parsed = Number(draft);
    if (draft !== null && draft.trim() !== "" && Number.isFinite(parsed)) onChange(clamp(parsed));
    setDraft(null);
  };

  return (
    <div className={`flex w-full max-w-[220px] items-center gap-2 ${disabled ? "opacity-40" : ""}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          setDraft(null);
          onChange(Number(e.target.value));
        }}
        className="min-w-0 flex-1 disabled:cursor-not-allowed"
      />
      <span className="flex w-[62px] shrink-0 items-center justify-end gap-0.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 focus-within:ring-1 focus-within:ring-[var(--accent)]">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={shown}
          disabled={disabled}
          aria-label={label ? `${label}, type a number` : "Type a number"}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full min-w-0 bg-transparent text-right text-[12px] text-white tabular-nums outline-none [appearance:textfield] disabled:cursor-not-allowed [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit ? <span className="shrink-0 text-[11px] text-white/45">{unit}</span> : null}
      </span>
    </div>
  );
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const parseHex = (value: string) => {
  if (!HEX.test(value)) return null;
  let hex = value.slice(1);
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
  return { rgb: `#${hex.slice(0, 6)}`, alpha };
};

const toHex8 = (rgb: string, alpha: number) =>
  `${rgb}${Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0")}`;

export function ColorField({
  value,
  onChange,
  withAlpha,
  swatches,
}: {
  value: string;
  onChange: (v: string) => void;
  withAlpha?: boolean;
  swatches?: string[];
}) {
  const parsed = parseHex(value);
  return (
    <div className="flex w-full flex-col items-end gap-2">
      <div className="flex w-full items-center justify-end gap-2">
        {withAlpha && parsed ? (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={parsed.alpha}
            title="How see-through it is"
            aria-label="Transparency"
            onChange={(e) => onChange(toHex8(parsed.rgb, Number(e.target.value)))}
            className="w-24"
          />
        ) : null}
        {parsed ? (
          <input
            type="color"
            aria-label="Pick a colour"
            value={parsed.rgb}
            onChange={(e) => onChange(withAlpha ? toHex8(e.target.value, parsed.alpha) : e.target.value)}
          />
        ) : (
          <span className="text-[11px] text-white/45">Custom value</span>
        )}
      </div>
      {swatches?.length ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {swatches.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`Use colour ${s}`}
              onClick={() => onChange(withAlpha && parsed ? toHex8(s, parsed.alpha) : s)}
              className="h-5 w-5 rounded-full border border-white/20 transition hover:scale-110"
              style={{ background: s }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "soft",
  icon,
  className = "",
  title,
  disabled,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "soft" | "primary" | "danger" | "ghost";
  icon?: IconName;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const styles = {
    soft: "bg-white/[0.08] hover:bg-white/15 text-white",
    primary: "bg-[var(--accent)] text-[var(--accent-ink)] font-semibold hover:brightness-110",
    danger: "bg-red-500/15 text-red-200 hover:bg-red-500/25",
    ghost: "text-white/70 hover:bg-white/10 hover:text-white",
  }[variant];
  return (
    <button
      type="button"
      title={title}
      aria-label={!children ? title : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] transition disabled:pointer-events-none disabled:opacity-30 ${styles} ${className}`}
    >
      {icon ? <Icon name={icon} size={15} /> : null}
      {children}
    </button>
  );
}

export function Dialog({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  width = 460,
  header,
  hidden,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  header?: ReactNode;
  hidden?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-300 sm:items-center ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[var(--chrome)] text-white shadow-2xl shadow-black/70 sm:max-h-[85dvh] sm:w-[var(--dialog-w)] sm:rounded-2xl"
        style={{ "--dialog-w": `${width}px` } as React.CSSProperties}
      >
        <div className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
          {header ?? (
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              {icon ? (
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                  <Icon name={icon} />
                </span>
              ) : null}
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold">{title}</h2>
                {subtitle ? <p className="text-[12.5px] leading-snug text-white/50">{subtitle}</p> : null}
              </div>
            </div>
          )}
          <Button variant="ghost" icon="close" title="Close" onClick={onClose} className="-mr-1 px-2" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <div className="flex shrink-0 gap-2 border-t border-white/10 p-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Popover({
  anchor,
  open,
  width,
  children,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  width: number;
  children: ReactNode;
}) {
  const pos = useAnchoredPosition(open, anchor, width);
  if (!open || !pos) return null;
  return createPortal(
    <div
      data-popover
      className="fixed z-40 max-h-[75dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[var(--chrome)] p-3 text-white shadow-2xl shadow-black/70"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
    >
      {children}
    </div>,
    document.body,
  );
}
