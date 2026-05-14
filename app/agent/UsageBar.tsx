import type { UsageState } from './types';
import { formatCost, formatTokens } from './utils';

export function UsageBar({ usage, active }: { usage: UsageState; active: boolean }) {
  const hasData = usage.totalTokens > 0;

  return (
    <div className={`flex items-center h-9 px-4 gap-0 font-mono text-[10px] tracking-widest border-b border-border-main bg-bg-surface shrink-0 overflow-x-auto no-scrollbar transition-colors ${active ? 'border-yellow-400/20' : ''}`}>
      <div className="text-text-3 pr-4 border-r border-border-main whitespace-nowrap">SESSION_USAGE</div>
      <Metric label="IN" value={formatTokens(usage.promptTokens)} suffix="tok" active={hasData} className="text-sky-400" />
      <Metric label="OUT" value={formatTokens(usage.completionTokens)} suffix="tok" active={hasData} className="text-violet-400" />
      <Metric label="TOTAL" value={formatTokens(usage.totalTokens)} suffix="tok" active={hasData} />
      <Metric label="CALLS" value={String(usage.llmCalls)} active={hasData} />

      <div className="flex items-center gap-1.5 px-4 whitespace-nowrap">
        <span className="text-text-3">COST</span>
        <span className={`font-bold text-[11px] ${usage.cost > 0.1 ? 'text-red-400' : usage.cost > 0.01 ? 'text-yellow-400' : hasData ? 'text-emerald-400' : 'text-text-3'}`}>
          {formatCost(usage.cost)}
        </span>
        {active && <span className="text-yellow-400 animate-pulse text-[8px] ml-1">●</span>}
      </div>

      {hasData && <div className="ml-auto pl-4 text-text-3 opacity-40 whitespace-nowrap hidden xl:block">accumulated this session</div>}
    </div>
  );
}

function Metric({ label, value, suffix, active, className = 'text-text-1' }: { label: string; value: string; suffix?: string; active: boolean; className?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-4 border-r border-border-main whitespace-nowrap">
      <span className="text-text-3">{label}</span>
      <span className={`font-bold ${active ? className : 'text-text-3'}`}>{value}</span>
      {suffix && <span className="text-text-3 text-[9px]">{suffix}</span>}
    </div>
  );
}
