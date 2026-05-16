"use client";

import "@xterm/xterm/css/xterm.css";
import { useTheme } from "next-themes";
import { Sidebar } from "@/components/Sidebar";
import { STATUS_CONFIG } from "./constants";
import { TerminalFooter } from "./TerminalFooter";
import { TerminalHeader } from "./TerminalHeader";
import { TerminalViewport } from "./TerminalViewport";
import { useClock } from "./useClock";
import { useTerminalResources } from "./useTerminalResources";
import { useTerminalShortcuts } from "./useTerminalShortcuts";
import { useTerminalTabs } from "./useTerminalTabs";

export default function TerminalPage() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;
  const { time, date } = useClock();

  const {
    tabs,
    tabsRef,
    activeId,
    activeIdRef,
    setActiveId,
    mountRefs,
    resources,
    initialized,
    addTab,
    closeTabById,
    updateTabStatus,
  } = useTerminalTabs();

  useTerminalShortcuts({
    tabsRef,
    activeIdRef,
    addTab,
    closeTabById,
    setActiveId,
  });

  const { setMountRef } = useTerminalResources({
    activeId,
    currentTheme,
    tabs,
    mountRefs,
    resources,
    initialized,
    updateTabStatus,
  });

  const activeTab = tabs.find((tab) => tab.id === activeId);
  const status = activeTab?.status ?? "connecting";
  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeId) + 1;

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <Sidebar activeTab="terminal" />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex-1 flex flex-col bg-bg-base relative overflow-hidden">
          <div className="flex flex-col h-full">
            <TerminalHeader
              tabs={tabs}
              activeId={activeId}
              date={date}
              time={time}
              statusConfig={STATUS_CONFIG[status]}
              onSelectTab={setActiveId}
              onAddTab={addTab}
              onCloseTab={closeTabById}
            />

            <TerminalViewport
              tabs={tabs}
              activeId={activeId}
              setMountRef={setMountRef}
            />

            <TerminalFooter activeTabIndex={activeTabIndex} totalTabs={tabs.length} />
          </div>
        </div>
      </div>
    </div>
  );
}
