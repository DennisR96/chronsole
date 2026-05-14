import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { AgentPhase } from './types';

type Props = {
  agentPhase: AgentPhase;
  date: string;
  time: string;
  isHistoryOpen: boolean;
  onNewConversation: () => void;
  onToggleHistory: () => void;
  onOpenSettings: () => void;
};

export function ChatHeader({ agentPhase, date, time, isHistoryOpen, onNewConversation, onToggleHistory, onOpenSettings }: Props) {
  return (
    <div className="flex h-12 bg-bg-surface shrink-0 items-end px-4 gap-2 overflow-x-auto no-scrollbar border-b border-border-main justify-between">
      <div className="flex items-center h-full pr-6 text-sm font-bold tracking-widest text-text-1 border-r border-border-main">
        CHRONOSOLE // AGENT_COMM
      </div>

      <div className="hidden lg:flex items-center h-full px-4 gap-6 font-mono text-[11px] text-text-2">
        <div className="flex items-center gap-2">
          <span className={`text-[8px] ${agentPhase !== 'idle' ? 'text-yellow-400 animate-pulse' : 'text-emerald-400'}`}>■</span>
          <span className={`tracking-wider ${agentPhase === 'awaiting_confirm' ? 'text-orange-400' : agentPhase !== 'idle' ? 'text-yellow-400' : 'text-emerald-400'}`}>
            {agentPhase === 'awaiting_confirm' ? 'AWAITING CONFIRM' : agentPhase !== 'idle' ? agentPhase.toUpperCase() : 'STANDBY'}
          </span>
        </div>

        <div className="tracking-wider">{date} // {time}</div>

        <button onClick={onNewConversation} className="hover:text-accent transition-colors tracking-wider flex items-center gap-1.5">
          <span className="text-accent">+</span> NEW
        </button>
        <button onClick={onToggleHistory} className="hover:text-accent transition-colors tracking-wider flex items-center gap-1.5">
          <span className="text-accent">{isHistoryOpen ? '−' : '+'}</span> HISTORY
        </button>
        <button onClick={onOpenSettings} className="hover:text-accent transition-colors tracking-wider flex items-center gap-2">
          <span className="text-accent text-[10px]">⚙</span> CONFIG
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
