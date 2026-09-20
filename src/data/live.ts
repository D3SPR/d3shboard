import type { DataSource, SourceState } from "./types";

/**
 * The newest values, outside React, so the agent bridge and diagnostics can read
 * what's actually on screen without being components themselves.
 */
let snapshot: { states: Record<string, SourceState>; sources: DataSource[] } = { states: {}, sources: [] };

export const setLiveData = (next: typeof snapshot) => {
  snapshot = next;
};

export const liveData = () => snapshot;
