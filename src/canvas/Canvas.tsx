import { forwardRef, useRef, useState } from "react";
import type { BreakpointKey, Rect, RenderBoard, Widget } from "../lib/types";
import { backgroundCss, createWidget, effectiveStyle, rectFor, shadowCss } from "../lib/board";
import { WidgetBody } from "../widgets/WidgetBody";
import { Icon } from "../ui/icons";

const HANDLES = ["nw", "ne", "sw", "se"] as const;

type Props = {
  board: RenderBoard;
  bp: BreakpointKey;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string) => void;
  updateRect: (id: string, patch: Partial<Rect>) => void;
  add: (w: Widget) => void;
};

export const Canvas = forwardRef<HTMLDivElement, Props>(function Canvas(
  { board, bp, selectedId, onSelect, onEdit, updateRect, add },
  ref,
) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const [dropping, setDropping] = useState(false);
  const editing = board.mode === "edit";
  const lastDown = useRef({ id: "", t: 0 });

  const snap = (v: number) => (board.snap ? Math.round(v / board.gridSize) * board.gridSize : Math.round(v));

  // The content overlay swallows dblclick, so detect double-taps from pointerdown timing.
  const noteTap = (id: string) => {
    const now = Date.now();
    const isDouble = lastDown.current.id === id && now - lastDown.current.t < 400;
    lastDown.current = { id, t: now };
    if (isDouble) onEdit(id);
  };

  const trackPointer = (move: (e: PointerEvent) => void) => {
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const startDrag = (e: React.PointerEvent, w: Widget, rect: Rect) => {
    if (!editing) return;
    e.stopPropagation();
    onSelect(w.id);
    noteTap(w.id);
    if (w.locked) return;
    const sx = e.clientX;
    const sy = e.clientY;
    trackPointer((ev) => {
      ev.preventDefault();
      updateRect(w.id, {
        x: Math.max(0, snap(rect.x + ev.clientX - sx)),
        y: Math.max(0, snap(rect.y + ev.clientY - sy)),
      });
    });
  };

  const startResize = (e: React.PointerEvent, w: Widget, rect: Rect, handle: string) => {
    e.stopPropagation();
    onSelect(w.id);
    const sx = e.clientX;
    const sy = e.clientY;
    trackPointer((ev) => {
      ev.preventDefault();
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let { x, y, w: width, h } = rect;
      if (handle.includes("e")) width = Math.max(80, rect.w + dx);
      if (handle.includes("s")) h = Math.max(60, rect.h + dy);
      if (handle.includes("w")) {
        width = Math.max(80, rect.w - dx);
        x = rect.x + (rect.w - width);
      }
      if (handle.includes("n")) {
        h = Math.max(60, rect.h - dy);
        y = rect.y + (rect.h - h);
      }
      updateRect(w.id, { x: snap(x), y: snap(y), w: snap(width), h: snap(h) });
    });
  };

  const setRefs = (el: HTMLDivElement | null) => {
    localRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const bg = board.background;

  return (
    <div
      ref={setRefs}
      onPointerDown={() => onSelect(null)}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        setDropping(false);
        if (!editing) return;
        e.preventDefault();
        const type = e.dataTransfer.getData("widget/type") as Widget["type"];
        if (!type) return;
        const box = localRef.current?.getBoundingClientRect();
        const x = snap(e.clientX - (box?.left ?? 0) - 60);
        const y = snap(e.clientY - (box?.top ?? 0) - 30);
        const z = Math.max(0, ...board.widgets.map((w) => w.z)) + 1;
        const widget = createWidget(type, Math.max(0, x), Math.max(0, y), z);
        add(widget);
        onSelect(widget.id);
      }}
      className="relative h-full min-h-full w-full overflow-hidden"
      style={{ ...backgroundCss(bg), fontFamily: `"${board.fontFamily}", system-ui, sans-serif` }}
    >
      {bg.dim > 0 ? (
        <div className="pointer-events-none absolute inset-0" style={{ background: `rgba(0,0,0,${bg.dim})` }} />
      ) : null}
      {editing && board.showGrid ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: `radial-gradient(circle, ${board.accent}33 1px, transparent 1px)`,
            backgroundSize: `${board.gridSize}px ${board.gridSize}px`,
          }}
        />
      ) : null}
      {dropping ? (
        <div
          className="pointer-events-none absolute inset-3 grid place-items-center rounded-3xl border-2 border-dashed text-sm"
          style={{ borderColor: board.accent, color: board.accent }}
        >
          Drop it here
        </div>
      ) : null}

      {board.widgets.map((w) => {
        const rect = rectFor(w, bp);
        if (rect.hidden && !editing) return null;
        const s = effectiveStyle(w, rect);
        const selected = editing && selectedId === w.id;
        return (
          <div
            key={w.id}
            data-widget-id={w.id}
            onPointerDown={(e) => startDrag(e, w, rect)}
            onDoubleClick={(e) => {
              if (!editing) return;
              e.stopPropagation();
              onEdit(w.id);
            }}
            className={`absolute ${editing ? "select-none" : ""} ${s.animation === "none" ? "" : `anim-${s.animation}`}`}
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              zIndex: w.z,
              opacity: rect.hidden ? 0.25 : s.opacity,
              touchAction: editing ? "none" : undefined,
              cursor: editing ? (w.locked ? "not-allowed" : "grab") : "default",
            }}
          >
            <div
              data-widget-card
              className="flex h-full w-full flex-col overflow-hidden"
              style={{
                background: s.bg,
                color: s.fg,
                border: `${s.borderWidth}px solid ${s.border}`,
                borderRadius: s.radius,
                padding: s.padding,
                fontFamily: s.fontFamily === "inherit" ? "inherit" : `"${s.fontFamily}", sans-serif`,
                fontSize: s.fontSize,
                fontWeight: s.fontWeight,
                letterSpacing: s.letterSpacing,
                textAlign: s.align,
                boxShadow: shadowCss(s, board.accent),
                backdropFilter: s.blur ? "blur(14px)" : undefined,
                outline: selected ? `2px solid ${board.accent}` : undefined,
                outlineOffset: 3,
              }}
            >
              {w.showTitle ? (
                <div
                  data-widget-title
                  className="mb-2 shrink-0 text-[0.7em] uppercase"
                  style={{ letterSpacing: "0.16em", opacity: 0.55 }}
                >
                  {w.title}
                </div>
              ) : null}
              <div data-widget-content className="relative min-h-0 flex-1">
                <WidgetBody widget={w} />
                {editing ? <div className="absolute inset-0" /> : null}
              </div>
            </div>

            {editing ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(w.id);
                }}
                aria-label={`Edit ${w.title}`}
                title="Edit this"
                className="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg shadow-black/50 transition hover:scale-110"
                style={{ background: board.accent, color: "#0b0a12" }}
              >
                <Icon name="pencil" size={15} />
              </button>
            ) : null}

            {editing && rect.hidden ? (
              <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/80">
                Hidden on this screen
              </span>
            ) : null}

            {selected && !w.locked
              ? HANDLES.map((h) => (
                  <span
                    key={h}
                    onPointerDown={(e) => startResize(e, w, rect, h)}
                    className="absolute grid h-8 w-8 place-items-center"
                    title="Drag to resize"
                    style={{
                      touchAction: "none",
                      cursor: `${h}-resize`,
                      top: h[0] === "n" ? -16 : undefined,
                      bottom: h[0] === "s" ? -16 : undefined,
                      left: h[1] === "w" ? -16 : undefined,
                      right: h[1] === "e" ? -16 : undefined,
                    }}
                  >
                    <span
                      className="block h-3.5 w-3.5 rounded-full border"
                      style={{ background: board.accent, borderColor: "#0008" }}
                    />
                  </span>
                ))
              : null}
          </div>
        );
      })}

      {board.widgets.length === 0 && editing ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/55">
          <div className="text-base font-medium text-white/80">This page is empty</div>
          <div className="text-sm">
            Press <b style={{ color: board.accent }}>Add</b> at the top to put something here.
          </div>
        </div>
      ) : null}
    </div>
  );
});
