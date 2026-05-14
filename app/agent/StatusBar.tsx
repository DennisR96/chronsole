import type { AgentPhase } from './types';

type Props = {
  agentPhase: AgentPhase;
  model: string;
  toolCount: number;
  workDir: string;
  mcpServerCount: number;
  onOpenSettings: () => void;
};

export function StatusBar({ agentPhase, model, toolCount, workDir, mcpServerCount, onOpenSettings }: Props) {
  const workDirLabel = workDir.trim()
    ? workDir.trim().split(/[\\/]/).filter(Boolean).pop()?.toUpperCase() ?? workDir.trim()
    : null;

  return (
    <div className="flex h-8 border-t border-border-main bg-bg-surface shrink-0 items-center px-4 justify-between font-mono text-[11px] text-text-3 tracking-widest overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-6 whitespace-nowrap">
        <div>MODEL: <span className="text-accent font-bold">{model.split('/').pop()?.toUpperCase() ?? 'UNKNOWN'}</span></div>
        <div>TOOLS: <span className="text-text-1 font-bold">{toolCount > 0 ? `${toolCount} CALLS` : 'READY'}</span></div>

        {workDirLabel && (
          <div className="flex items-center gap-1.5 pl-6 border-l border-border-main">
            <span className="text-text-3">/</span>
            <span className="text-sky-400 font-bold cursor-pointer hover:text-sky-300 transition-colors" title={workDir} onClick={onOpenSettings}>{workDirLabel}</span>
          </div>
        )}

        {mcpServerCount > 0 && (
          <div className="flex items-center gap-1.5 pl-6 border-l border-border-main">
            <span className="text-text-3">🔌</span>
            <span className="text-violet-400 font-bold cursor-pointer hover:text-violet-300 transition-colors" title="Configured MCP servers" onClick={onOpenSettings}>MCP:{mcpServerCount}</span>
          </div>
        )}

        <div className="flex items-center gap-4 pl-6 border-l border-border-main">
          <div className="flex items-center gap-2"><span className="border border-border-main px-1.5 rounded text-text-1 bg-bg-base">↵</span>SEND</div>
          <div className="text-yellow-400/60">⌘ SHELL • 📁 FS • ✏️ WRITE • 🔌 MCP</div>
        </div>
      </div>

      <div className="flex items-center gap-2 whitespace-nowrap pl-4">
        <span className={`text-[10px] ${agentPhase === 'awaiting_confirm' ? 'text-orange-400 animate-pulse' : agentPhase !== 'idle' ? 'text-yellow-400 animate-pulse' : 'text-emerald-400'}`}>∿</span>
        {agentPhase === 'awaiting_confirm' ? 'AWAITING CONFIRM' : agentPhase !== 'idle' ? agentPhase.toUpperCase() : 'IDLE'}
      </div>
    </div>
  );
}
