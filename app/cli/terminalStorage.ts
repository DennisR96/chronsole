import { ACTIVE_TAB_KEY, DEFAULT_TAB_ID, DEFAULT_TAB_LABEL, STORAGE_KEY } from "./constants";
import type { Tab } from "./types";

export function createTab(label = DEFAULT_TAB_LABEL): Tab {
  return {
    id: crypto.randomUUID(),
    label,
    status: "connecting",
  };
}

export function loadInitialTabs(): Tab[] {
  if (typeof window === "undefined") {
    return [
      {
        id: DEFAULT_TAB_ID,
        label: DEFAULT_TAB_LABEL,
        status: "connecting",
      },
    ];
  }

  const saved = window.sessionStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Tab[];

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((tab, index) => ({
          id: tab.id,
          label: tab.label || `TTY${index + 1}`,
          status: "connecting",
        }));
      }
    } catch {
      // Fall through to default tab.
    }
  }

  return [createTab(DEFAULT_TAB_LABEL)];
}

export function loadInitialActiveId(tabs: Tab[]) {
  if (typeof window === "undefined") {
    return tabs[0]?.id;
  }

  const saved = window.sessionStorage.getItem(ACTIVE_TAB_KEY);

  if (saved && tabs.some((tab) => tab.id === saved)) {
    return saved;
  }

  return tabs[0]?.id;
}

export function persistTabs(tabs: Tab[]) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }
}

export function persistActiveTab(activeId?: string) {
  if (typeof window !== "undefined" && activeId) {
    window.sessionStorage.setItem(ACTIVE_TAB_KEY, activeId);
  }
}
