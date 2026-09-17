import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "../ui/icons";

type Props = {
  count: number;
  index: number;
  accent: string;
  go: (index: number) => void;
  children: ReactNode;
};

export function PanelPager({ count, index, accent, go, children }: Props) {
  const wheelLock = useRef(0);
  const indexRef = useRef(index);
  indexRef.current = index;
  const touch = useRef<{ x: number; y: number } | null>(null);

  const step = (delta: number) => {
    const next = indexRef.current + delta;
    if (next >= 0 && next < count) go(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.tagName === "SELECT" || t?.isContentEditable) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onWheel={(e) => {
        if (Math.abs(e.deltaX) < 24 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
        const now = Date.now();
        if (now < wheelLock.current) return;
        wheelLock.current = now + 500;
        step(e.deltaX > 0 ? 1 : -1);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") touch.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
      }}
    >
      <div className="h-full w-full">{children}</div>
      {count > 1 ? (
        <>
          {index > 0 ? (
            <button
              onClick={() => step(-1)}
              aria-label="Previous page"
              className="absolute top-1/2 left-1 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/70 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            >
              <Icon name="left" size={18} />
            </button>
          ) : null}
          {index < count - 1 ? (
            <button
              onClick={() => step(1)}
              aria-label="Next page"
              className="absolute top-1/2 right-1 z-30 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/70 backdrop-blur-sm transition hover:bg-black/60 hover:text-white"
            >
              <Icon name="right" size={18} />
            </button>
          ) : null}
          <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-2 rounded-full bg-black/30 px-3 py-2 backdrop-blur-sm">
            {Array.from({ length: count }).map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Go to page ${i + 1}`}
                className="h-2 w-2 rounded-full transition"
                style={{ background: i === index ? accent : "rgba(255,255,255,.3)" }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
