interface TerminalFooterProps {
  activeTabIndex: number;
  totalTabs: number;
}

export function TerminalFooter({ activeTabIndex, totalTabs }: TerminalFooterProps) {
  return (
    <div className="flex h-8 border-t border-border-main bg-bg-surface shrink-0 items-center px-4 justify-between font-mono text-[11px] text-text-3 tracking-widest overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-6 whitespace-nowrap">
        <div>
          ENV: <span className="text-accent font-bold">PRODUCTION</span>
        </div>

        <div>
          ENC: <span className="text-text-1 font-bold">UTF-8</span>
        </div>

        <div className="flex items-center gap-4 pl-6 border-l border-border-main">
          <ShortcutKey keys="^C" label="INT" />
          <ShortcutKey keys="^D" label="EOF" />
          <ShortcutKey keys="⌘T" label="NEW" />
          <ShortcutKey keys="⌘W" label="CLOSE" />
        </div>
      </div>

      <div className="flex items-center gap-2 whitespace-nowrap pl-4">
        <span className="text-accent text-[10px]">∿</span>
        WS // ACTIVE: {activeTabIndex}/{totalTabs}
      </div>
    </div>
  );
}

function ShortcutKey({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="border border-border-main px-1.5 rounded text-text-1 bg-bg-base">
        {keys}
      </span>
      {label}
    </div>
  );
}
