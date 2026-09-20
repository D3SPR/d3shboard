import { uid } from "../lib/board.ts";
import type { CanvasItem, CompNode } from "./types";

export type Canvas = Extract<CompNode, { kind: "canvas" }>;

export const isCanvas = (node: CompNode | undefined | null): node is Canvas => !!node && node.kind === "canvas";

export const emptyCanvas = (): Canvas => ({ kind: "canvas", items: [] });

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Keeps a piece inside the component, and big enough to grab. */
export const clampBox = (box: { x: number; y: number; w: number; h: number }) => {
  const w = Math.min(1, Math.max(0.06, box.w));
  const h = Math.min(1, Math.max(0.06, box.h));
  return { x: clamp01(Math.min(box.x, 1 - w)), y: clamp01(Math.min(box.y, 1 - h)), w, h };
};

export const addItem = (canvas: Canvas, node: CompNode, box?: Partial<CanvasItem>): { canvas: Canvas; id: string } => {
  const id = uid();
  // New pieces stack down the middle so they never land exactly on top of each other.
  const step = (canvas.items.length % 5) * 0.14;
  const item: CanvasItem = {
    id,
    x: 0.06,
    y: clamp01(0.08 + step),
    w: 0.88,
    h: 0.18,
    align: "start",
    ...box,
    node,
  };
  return { canvas: { ...canvas, items: [...canvas.items, { ...item, ...clampBox(item) }] }, id };
};

export const updateItem = (canvas: Canvas, id: string, patch: Partial<CanvasItem>): Canvas => ({
  ...canvas,
  items: canvas.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
});

export const updateItemNode = (canvas: Canvas, id: string, node: CompNode): Canvas => updateItem(canvas, id, { node });

export const removeItem = (canvas: Canvas, id: string): Canvas => ({
  ...canvas,
  items: canvas.items.filter((item) => item.id !== id),
});

export const raiseItem = (canvas: Canvas, id: string): Canvas => {
  const item = canvas.items.find((i) => i.id === id);
  if (!item) return canvas;
  return { ...canvas, items: [...canvas.items.filter((i) => i.id !== id), item] };
};

/**
 * Turns a design that arranges itself into one you can drag around, by measuring
 * where its pieces actually ended up on screen. `host` is the element the component
 * was just rendered into at its real size.
 */
export function convertToCanvas(root: CompNode, host: HTMLElement | null): Canvas {
  if (isCanvas(root)) return root;

  const box = host?.getBoundingClientRect();
  const rendered = host?.firstElementChild;

  if (root.kind === "stack" && box?.width && box.height && rendered) {
    const drawn = Array.from(rendered.children) as HTMLElement[];
    const items = root.children.map((child, i) => {
      const rect = drawn[i]?.getBoundingClientRect();
      // A measured box hugs its text exactly, which would clip the moment anything
      // reflows — so each piece keeps a little slack around it.
      const slack = 0.03;
      const measured = rect
        ? {
            x: (rect.left - box.left) / box.width - slack / 2,
            y: (rect.top - box.top) / box.height - slack / 2,
            w: rect.width / box.width + slack,
            h: rect.height / box.height + slack,
          }
        : { x: 0.06, y: 0.06 + i * 0.2, w: 0.88, h: 0.16 };
      const align = measured.x > 0.15 && measured.x + measured.w < 0.85 ? ("center" as const) : ("start" as const);
      return { id: uid(), ...clampBox(measured), align, node: child };
    });
    if (items.length) return { kind: "canvas", items };
  }

  // Anything else (a list, a condition, a single piece) becomes one piece filling the card.
  return { kind: "canvas", items: [{ id: uid(), x: 0.04, y: 0.06, w: 0.92, h: 0.88, align: "start", node: root }] };
}
