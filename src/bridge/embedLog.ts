export type EmbedProblem = { widgetId: string; message: string; at: number };

const entries: EmbedProblem[] = [];
let listening = false;

// Custom panels run in a sandboxed frame, so they report their own errors up to the page.
export function startEmbedLog() {
  if (listening) return;
  listening = true;
  window.addEventListener("message", (event) => {
    const data = event.data as { __d3sh?: number; widgetId?: unknown; message?: unknown } | null;
    if (!data || data.__d3sh !== 1 || typeof data.widgetId !== "string") return;
    entries.push({ widgetId: data.widgetId, message: String(data.message ?? "").slice(0, 300), at: Date.now() });
    if (entries.length > 100) entries.shift();
  });
}

export const embedProblems = (widgetId: string) => entries.filter((e) => e.widgetId === widgetId);
export const clearEmbedProblems = (widgetId: string) => {
  for (let i = entries.length - 1; i >= 0; i--) if (entries[i].widgetId === widgetId) entries.splice(i, 1);
};
