import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Tab } from "./types";

interface UseTerminalShortcutsArgs {
  tabsRef: MutableRefObject<Tab[]>;
  activeIdRef: MutableRefObject<string>;
  addTab: () => void;
  closeTabById: (tabId: string) => void;
  setActiveId: (tabId: string) => void;
}

export function useTerminalShortcuts({
  tabsRef,
  activeIdRef,
  addTab,
  closeTabById,
  setActiveId,
}: UseTerminalShortcutsArgs) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();

      if (key === "t") {
        event.preventDefault();
        addTab();
        return;
      }

      if (key === "w") {
        event.preventDefault();
        closeTabById(activeIdRef.current);
        return;
      }

      const tabNumber = parseInt(event.key, 10);

      if (!Number.isNaN(tabNumber) && tabNumber >= 1 && tabNumber <= 9) {
        const target = tabsRef.current[tabNumber - 1];

        if (target) {
          event.preventDefault();
          setActiveId(target.id);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdRef, addTab, closeTabById, setActiveId, tabsRef]);
}
