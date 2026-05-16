import type { MouseEvent } from "react";
import type { Tab } from "./types";

interface TerminalTabsProps {
  tabs: Tab[];
  activeId: string;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
}

export function TerminalTabs({
  tabs,
  activeId,
  onSelectTab,
  onAddTab,
  onCloseTab,
}: TerminalTabsProps) {
  const closeTab = (event: MouseEvent, tabId: string) => {
    event.stopPropagation();
    onCloseTab(tabId);
  };

  return (
    <div className="flex flex-1 items-end h-full gap-1 pt-2 border-l border-border-main pl-2">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;

        return (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`group flex items-center gap-3 px-4 h-full min-w-[120px] cursor-pointer transition-colors relative ${
              isActive
                ? "bg-bg-base text-text-1 z-10 border-t-2 border-accent"
                : "bg-transparent hover:bg-bg-raised text-text-3 border-t-2 border-transparent"
            }`}
          >
            {isActive && (
              <div className="absolute inset-x-0 top-0 h-[1px] shadow-[0_0_12px_1px_var(--accent)] opacity-40 pointer-events-none" />
            )}

            <span
              className={`text-[8px] ${
                tab.status === "connected" ? "text-accent" : "text-text-3"
              }`}
            >
              ■
            </span>

            <span className="text-sm font-mono font-semibold">{tab.label}</span>

            {index < 9 && (
              <span
                className={`text-[10px] border px-1 rounded transition-opacity ${
                  isActive
                    ? "border-text-3 opacity-100"
                    : "border-border-main opacity-0 group-hover:opacity-100"
                }`}
              >
                ⌘{index + 1}
              </span>
            )}

            {tabs.length > 1 && (
              <span
                className="ml-auto text-xs opacity-0 group-hover:opacity-100 hover:text-accent transition-all"
                onClick={(event) => closeTab(event, tab.id)}
              >
                ✕
              </span>
            )}
          </div>
        );
      })}

      <button
        onClick={onAddTab}
        className="h-full px-4 text-text-3 hover:text-text-1 transition-colors mb-1"
      >
        +
      </button>
    </div>
  );
}
