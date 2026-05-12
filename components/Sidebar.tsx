import {
  Zap,
  TerminalSquare,
  Folder,
  Settings,
  Clock,
  LineChart,
  Box,
  Activity
} from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="w-16 shrink-0 flex flex-col items-center py-4 bg-bg-surface border-r border-border-main z-20 h-full justify-between">
      <div className="text-accent mb-6 mt-2">
        <Zap size={22} fill="currentColor" />
      </div>

      <div className="flex flex-col gap-6 w-full items-center flex-1">
        <div className="w-10 h-10 rounded-xl bg-bg-base flex items-center justify-center text-accent border border-accent/30 cursor-pointer shadow-[0_0_10px_rgba(204,255,0,0.1)] transition-all">
          <TerminalSquare size={20} strokeWidth={2} />
        </div>
        <Folder size={20} className="text-text-3 hover:text-text-1 cursor-pointer transition-colors" />
        <Settings size={20} className="text-text-3 hover:text-text-1 cursor-pointer transition-colors" />
        <Clock size={20} className="text-text-3 hover:text-text-1 cursor-pointer transition-colors" />
        <LineChart size={20} className="text-text-3 hover:text-text-1 cursor-pointer transition-colors" />
        <Box size={20} className="text-text-3 hover:text-text-1 cursor-pointer transition-colors" />
        <Activity size={20} className="text-text-3 hover:text-text-1 cursor-pointer transition-colors" />
      </div>

      <div className="w-10 h-10 rounded-full border border-border-main flex items-center justify-center text-text-1 font-bold mb-2 cursor-pointer relative hover:border-accent transition-colors">
        N
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-accent rounded-full border-2 border-bg-surface"></div>
      </div>
    </aside>
  );
}
