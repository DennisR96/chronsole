import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { TerminalTabs } from "./TerminalTabs";
import type { StatusConfig, Tab } from "./types";

interface TerminalHeaderProps {
  tabs: Tab[];
  activeId: string;
  date: string;
  time: string;
  statusConfig: StatusConfig;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
}

export function TerminalHeader({
  tabs,
  activeId,
  date,
  time,
  statusConfig,
  onSelectTab,
  onAddTab,
  onCloseTab,
}: TerminalHeaderProps) {
  return (
    <div className="flex h-12 bg-bg-surface shrink-0 items-end px-4 gap-2 overflow-x-auto no-scrollbar border-b border-border-main">
      <div className="flex items-center h-full pr-6 text-sm font-bold tracking-widest text-text-1">
        CHRONOSOLE // TTY
      </div>

      <TerminalTabs
        tabs={tabs}
        activeId={activeId}
        onSelectTab={onSelectTab}
        onAddTab={onAddTab}
        onCloseTab={onCloseTab}
      />

      <div className="hidden lg:flex items-center h-full px-4 gap-6 font-mono text-[11px] text-text-2 border-l border-border-main">
        <div className="flex items-center gap-2">
          <span className="text-accent text-[8px]">{statusConfig.icon}</span>
          <span className="text-accent tracking-wider">{statusConfig.label}</span>
        </div>

        <div className="tracking-wider">
          {date} // {time}
        </div>

        <ThemeToggle />
      </div>
    </div>
  );
}
