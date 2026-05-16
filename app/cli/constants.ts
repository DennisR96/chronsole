import type { StatusConfig, TabStatus } from "./types";

export const STORAGE_KEY = "chronosole-terminal-tabs";
export const ACTIVE_TAB_KEY = "chronosole-active-terminal-tab";

export const DEFAULT_TAB_ID = "initial-terminal";
export const DEFAULT_TAB_LABEL = "TTY1";

export const STATUS_CONFIG: Record<TabStatus, StatusConfig> = {
  connected: { label: "ONLINE", icon: "■" },
  connecting: { label: "LINKING", icon: "▲" },
  disconnected: { label: "OFFLINE", icon: "▼" },
};
