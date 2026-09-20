export const BRIDGE_PORT = 7331;
export const BRIDGE_HOST = "127.0.0.1";
export const BRIDGE_WS_URL = `ws://${BRIDGE_HOST}:${BRIDGE_PORT}/bridge`;
export const BRIDGE_MCP_URL = `http://${BRIDGE_HOST}:${BRIDGE_PORT}/mcp`;
export const BRIDGE_PROTOCOL_VERSION = 1;

export type BridgeMethod =
  | "getDashboard"
  | "addPage"
  | "updatePage"
  | "deletePage"
  | "setView"
  | "addWidget"
  | "updateWidget"
  | "setWidgetLayout"
  | "deleteWidget"
  | "addAnimation"
  | "updateAnimation"
  | "deleteAnimation"
  | "addAutomation"
  | "updateAutomation"
  | "deleteAutomation"
  | "replaceDashboard"
  | "listComponents"
  | "addComponent"
  | "listDataSources"
  | "addDataSource"
  | "updateDataSource"
  | "deleteDataSource"
  | "listVariables"
  | "listThemes"
  | "applyTheme"
  | "listTemplates"
  | "applyTemplate"
  | "checkDashboard"
  | "undo";

export type PageToServer =
  | { type: "hello"; code: string; protocol: number }
  | { type: "result"; id: string; ok: true; result: unknown }
  | { type: "result"; id: string; ok: false; error: string };

export type ServerToPage =
  | { type: "welcome" }
  | { type: "rejected"; reason: string }
  | { type: "replaced" }
  | { type: "call"; id: string; method: BridgeMethod; params: Record<string, unknown> };
