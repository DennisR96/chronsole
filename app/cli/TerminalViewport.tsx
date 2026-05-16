import type { Tab } from "./types";

interface TerminalViewportProps {
  tabs: Tab[];
  activeId: string;
  setMountRef: (tabId: string) => (el: HTMLDivElement | null) => void;
}

export function TerminalViewport({ tabs, activeId, setMountRef }: TerminalViewportProps) {
  return (
    <div className="flex-1 relative bg-bg-base overflow-hidden">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`absolute inset-0 transition-opacity duration-200 ${
            tab.id === activeId
              ? "opacity-100 pointer-events-auto z-10"
              : "opacity-0 pointer-events-none z-0"
          }`}
        >
          <div ref={setMountRef(tab.id)} className="w-full h-full" />
        </div>
      ))}
    </div>
  );
}
