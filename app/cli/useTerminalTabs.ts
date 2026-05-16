import { useCallback, useEffect, useRef, useState } from "react";
import { createTab, loadInitialActiveId, loadInitialTabs, persistActiveTab, persistTabs } from "./terminalStorage";
import type { Tab, TerminalResource } from "./types";

export function useTerminalTabs() {
  const initialTabs = useRef<Tab[]>(loadInitialTabs());

  const [tabs, setTabs] = useState<Tab[]>(initialTabs.current);
  const [activeId, setActiveId] = useState<string>(() =>
    loadInitialActiveId(initialTabs.current)
  );

  const mountRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const resources = useRef<Map<string, TerminalResource>>(new Map());
  const initialized = useRef<Set<string>>(new Set());
  const tabsRef = useRef<Tab[]>(tabs);
  const activeIdRef = useRef<string>(activeId);

  useEffect(() => {
    tabsRef.current = tabs;
    persistTabs(tabs);
  }, [tabs]);

  useEffect(() => {
    activeIdRef.current = activeId;
    persistActiveTab(activeId);
  }, [activeId]);

  const disposeTab = useCallback((tabId: string, killSession = false) => {
    resources.current.get(tabId)?.dispose(killSession);
    resources.current.delete(tabId);
    initialized.current.delete(tabId);
    mountRefs.current.delete(tabId);
  }, []);

  const addTab = useCallback(() => {
    const currentCount = tabsRef.current.length;
    const tab = createTab(`TTY${currentCount + 1}`);

    setTabs((prev) => [...prev, tab]);
    setActiveId(tab.id);
  }, []);

  const closeTabById = useCallback(
    (tabId: string) => {
      const currentTabs = tabsRef.current;

      if (currentTabs.length <= 1) return;

      disposeTab(tabId, true);

      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);

        if (tabId === activeIdRef.current && next.length > 0) {
          setActiveId(next[Math.min(idx, next.length - 1)].id);
        }

        return next;
      });
    },
    [disposeTab]
  );

  const updateTabStatus = useCallback((tabId: string, status: Tab["status"]) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, status } : tab))
    );
  }, []);

  return {
    tabs,
    setTabs,
    tabsRef,
    activeId,
    activeIdRef,
    setActiveId,
    mountRefs,
    resources,
    initialized,
    addTab,
    closeTabById,
    disposeTab,
    updateTabStatus,
  };
}
