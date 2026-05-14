"use client";

import { useRouter } from "next/navigation";
import {
  Zap,
  Home,
  TerminalSquare,
  Folder,
  Settings,
  LineChart,
  Bot,
  Globe,
} from "lucide-react";

export type SidebarTab =
  | "home"
  | "terminal"
  | "chat"
  | "files"
  | "system"
  | "browser"
  | "settings";

interface SidebarProps {
  activeTab: SidebarTab;
}

const routeMap: Record<SidebarTab, string> = {
  home: "/",
  terminal: "/cli",
  chat: "/agent",
  files: "/file-explorer",
  system: "/system",
  browser: "/browser",
  settings: "/settings",
};

export function Sidebar({ activeTab }: SidebarProps) {
  const router = useRouter();

  const NavIcon = ({
    tab,
    Icon,
  }: {
    tab: SidebarTab;
    Icon: React.ComponentType<{
      size?: number;
      strokeWidth?: number;
      fill?: string;
    }>;
  }) => {
    const isActive = activeTab === tab;

    return (
      <div
        onClick={() => router.push(routeMap[tab])}
        className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all ${isActive
            ? "bg-bg-base text-accent border border-accent/30 shadow-[0_0_10px_rgba(204,255,0,0.1)]"
            : "text-text-3 hover:text-text-1 hover:bg-bg-raised border border-transparent"
          }`}
      >
        <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
      </div>
    );
  };

  return (
    <aside className="w-16 shrink-0 flex flex-col items-center py-4 bg-bg-surface border-r border-border-main z-20 h-full justify-between">
      <div className="text-accent mb-6 mt-2">
        <Zap size={22} fill="currentColor" />
      </div>

      <div className="flex flex-col gap-4 w-full items-center flex-1">
        <NavIcon tab="home" Icon={Home} />
        <NavIcon tab="terminal" Icon={TerminalSquare} />
        <NavIcon tab="chat" Icon={Bot} />
        <NavIcon tab="files" Icon={Folder} />
        <NavIcon tab="system" Icon={LineChart} />
        <NavIcon tab="browser" Icon={Globe} />
        <NavIcon tab="settings" Icon={Settings} />
      </div>
    </aside>
  );
}
