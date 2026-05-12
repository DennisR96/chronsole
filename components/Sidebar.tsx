import { useRouter } from 'next/navigation';
import { Zap, TerminalSquare, Folder, Settings, Clock, LineChart, Box, Activity } from 'lucide-react';

export type SidebarTab = 'terminal' | 'files' | 'settings' | 'history' | 'metrics' | 'packages' | 'activity';

interface SidebarProps {
  activeTab: SidebarTab;
}

// Map side tab names directly to app path routes
const routeMap: Record<SidebarTab, string> = {
  terminal: '/',
  files: '/file-explorer',
  settings: '/settings',
  history: '/history',
  metrics: '/metrics',
  packages: '/packages',
  activity: '/activity',
};

export function Sidebar({ activeTab }: SidebarProps) {
  const router = useRouter();

  const NavIcon = ({ tab, Icon }: { tab: SidebarTab, Icon: any }) => {
    const isActive = activeTab === tab;
    return (
      <div
        onClick={() => router.push(routeMap[tab])}
        className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all ${isActive
          ? 'bg-bg-base text-accent border border-accent/30 shadow-[0_0_10px_rgba(204,255,0,0.1)]'
          : 'text-text-3 hover:text-text-1 hover:bg-bg-raised border border-transparent'
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
        <NavIcon tab="terminal" Icon={TerminalSquare} />
        <NavIcon tab="files" Icon={Folder} />
        <NavIcon tab="settings" Icon={Settings} />
        <NavIcon tab="history" Icon={Clock} />
        <NavIcon tab="metrics" Icon={LineChart} />
        <NavIcon tab="packages" Icon={Box} />
        <NavIcon tab="activity" Icon={Activity} />
      </div>

      <div className="w-10 h-10 rounded-full border border-border-main flex items-center justify-center text-text-1 font-bold mb-2 cursor-pointer relative hover:border-accent transition-colors">
        N
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-accent rounded-full border-2 border-bg-surface"></div>
      </div>
    </aside>
  );
}
