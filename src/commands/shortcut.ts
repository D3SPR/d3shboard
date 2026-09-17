export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const PALETTE_SHORTCUT = IS_MAC ? "⌘K" : "Ctrl+K";
export const PALETTE_SHORTCUT_ALT = "Ctrl+Space";

// Ctrl+Space is swallowed by the OS on macOS and by many Linux input methods, so Ctrl/⌘+K always works too.
export const isPaletteHotkey = (e: KeyboardEvent) =>
  (e.ctrlKey && !e.altKey && !e.metaKey && (e.code === "Space" || e.key === " ")) ||
  ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k");
