import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, PendingToolCall } from './types';
import { formatMcpToolName, formatToolSummary, riskLevel, toolIcon } from './utils';

export function ToolCallBubble({ msg }: { msg: Message }) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] tracking-wider font-mono">
        <span className="text-yellow-400">TOOL</span>
        <span>{msg.timestamp}</span>
      </div>

      <div className="max-w-[90%] border border-yellow-400/30 bg-yellow-400/5 font-mono text-sm">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-yellow-400/20">
          <span className="text-yellow-400 text-xs">{toolIcon(msg.toolName ?? '')}</span>
          <span className="text-yellow-400 font-bold text-[11px] tracking-widest uppercase">
            {formatMcpToolName(msg.toolName ?? '')}
          </span>
          <span className="ml-auto text-yellow-400/40 text-[10px]">EXECUTING</span>
        </div>

        <div className="px-3 py-2 text-yellow-200/80 text-[12px] break-all whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export function ToolResultBubble({
  msg,
  onToggle,
}: {
  msg: Message;
  onToggle: (id: string) => void;
}) {
  const isLong = msg.content.length > 400;
  const displayContent = msg.collapsed && isLong ? `${msg.content.slice(0, 400)}…` : msg.content;

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] tracking-wider font-mono">
        <span className="text-emerald-400">RESULT</span>
        <span className="text-text-3">{formatMcpToolName(msg.toolName ?? '')}</span>
        <span>{msg.timestamp}</span>
      </div>

      <div className="max-w-[90%] border border-emerald-400/25 bg-emerald-400/5 font-mono text-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-emerald-400/15 text-[10px] tracking-widest">
          <span className="text-emerald-400">✓</span>
          <span className="text-emerald-400/70 uppercase">Output</span>

          {isLong && (
            <button
              onClick={() => onToggle(msg.id)}
              className="ml-auto text-emerald-400/50 hover:text-emerald-400 transition-colors"
            >
              {msg.collapsed ? '[EXPAND]' : '[COLLAPSE]'}
            </button>
          )}
        </div>

        <pre className="px-3 py-2 text-emerald-200/70 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
          {displayContent}
        </pre>
      </div>
    </div>
  );
}

export function MemoryBubble({
  msg,
  onToggle,
}: {
  msg: Message;
  onToggle: (id: string) => void;
}) {
  const isLong = msg.content.length > 700;
  const displayContent = msg.collapsed && isLong ? `${msg.content.slice(0, 700)}…` : msg.content;

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1 opacity-70 text-[10px] tracking-wider font-mono">
        <span className="text-cyan-400">MEMORY</span>
        <span>{msg.timestamp}</span>
      </div>

      <div className="max-w-[90%] border border-cyan-400/30 bg-cyan-400/5 font-mono text-sm">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-400/20">
          <span className="text-cyan-400 text-xs">◈</span>
          <span className="text-cyan-400 font-bold text-[11px] tracking-widest uppercase">
            {msg.memoryMode === 'last_user_messages' ? 'LAST-N CONTEXT ACTIVE' : 'CONTEXT SUMMARY ACTIVE'}
          </span>

          {isLong && (
            <button
              onClick={() => onToggle(msg.id)}
              className="ml-auto text-cyan-400/60 hover:text-cyan-400 transition-colors text-[10px] tracking-widest"
            >
              {msg.collapsed ? '[EXPAND]' : '[COLLAPSE]'}
            </button>
          )}
        </div>

        <div className="px-3 py-2 text-cyan-100/80 text-[12px] leading-relaxed whitespace-pre-wrap">
          {displayContent}
        </div>
      </div>
    </div>
  );
}

const RISK_COLORS = {
  low: {
    border: 'border-sky-400/30',
    bg: 'bg-sky-400/5',
    badge: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
    label: 'LOW RISK',
  },
  medium: {
    border: 'border-yellow-400/40',
    bg: 'bg-yellow-400/5',
    badge: 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10',
    label: 'MEDIUM RISK',
  },
  high: {
    border: 'border-red-400/50',
    bg: 'bg-red-400/5',
    badge: 'text-red-400 border-red-400/40 bg-red-400/10',
    label: 'HIGH RISK',
  },
};

export function ToolConfirmBubble({
  msg,
  onResolve,
}: {
  msg: Message;
  onResolve: (msgId: string, approved: PendingToolCall[], denied: PendingToolCall[]) => void;
}) {
  const calls = msg.pendingToolCalls ?? [];
  const [decisions, setDecisions] = useState<(boolean | null)[]>(() => calls.map(() => null));

  const decide = (idx: number, value: boolean | null) =>
    setDecisions((prev) => prev.map((d, i) => (i === idx ? value : d)));

  const allDecided = decisions.every((d) => d !== null);
  const handleApproveAll = () => setDecisions(calls.map(() => true));
  const handleDenyAll = () => setDecisions(calls.map(() => false));

  const handleConfirm = () => {
    if (!allDecided) return;

    const approved = calls.filter((_, i) => decisions[i] === true);
    const denied = calls.filter((_, i) => decisions[i] === false);

    onResolve(msg.id, approved, denied);
  };

  if (msg.confirmResolved) {
    const approved = calls.filter((_, i) => decisions[i] === true);
    const denied = calls.filter((_, i) => decisions[i] === false);

    return (
      <div className="flex flex-col items-start">
        <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] tracking-wider font-mono">
          <span className="text-text-3">CONFIRM</span>
          <span>{msg.timestamp}</span>
        </div>

        <div className="font-mono text-[11px] text-text-3 tracking-wider">
          {approved.length > 0 && (
            <span className="text-emerald-400 mr-4">✓ {approved.length} approved</span>
          )}
          {denied.length > 0 && <span className="text-red-400">✗ {denied.length} denied</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] tracking-wider font-mono">
        <span className="text-orange-400 animate-pulse">▲ CONFIRM</span>
        <span>{msg.timestamp}</span>
      </div>

      <div className="max-w-[95%] w-full border border-orange-400/40 bg-orange-400/5 font-mono text-sm">
        <div className="flex items-center gap-3 px-3 py-2 border-b border-orange-400/20 bg-orange-400/5">
          <span className="text-orange-400 font-bold text-[11px] tracking-widest uppercase">
            ⚠ TOOL EXECUTION REQUIRES APPROVAL
          </span>

          <div className="ml-auto flex gap-2">
            <button
              onClick={handleApproveAll}
              className="text-[10px] px-2 py-0.5 border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 transition-colors tracking-widest"
            >
              APPROVE ALL
            </button>
            <button
              onClick={handleDenyAll}
              className="text-[10px] px-2 py-0.5 border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors tracking-widest"
            >
              DENY ALL
            </button>
          </div>
        </div>

        <div className="divide-y divide-orange-400/10">
          {calls.map((tc, idx) => {
            const risk = riskLevel(tc.name, tc.args);
            const colors = RISK_COLORS[risk];
            const decision = decisions[idx];
            const summary = formatToolSummary(tc.name, tc.args);

            return (
              <div
                key={tc.id}
                className={`px-3 py-3 ${colors.bg} border-l-2 ${colors.border} transition-colors`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{toolIcon(tc.name)}</span>
                  <span className="text-text-1 font-bold text-[11px] tracking-widest uppercase">
                    {formatMcpToolName(tc.name)}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 border font-bold tracking-widest ${colors.badge}`}>
                    {colors.label}
                  </span>

                  {decision !== null && (
                    <span
                      className={`ml-auto text-[10px] font-bold tracking-widest ${decision ? 'text-emerald-400' : 'text-red-400'
                        }`}
                    >
                      {decision ? '✓ APPROVED' : '✗ DENIED'}
                    </span>
                  )}
                </div>

                <div className="mb-2 text-[12px] text-text-2 break-all whitespace-pre-wrap bg-bg-base px-2 py-1.5 border border-border-main">
                  {summary}
                </div>

                {Object.keys(tc.args).length > 0 && tc.name !== 'shell_execute' && (
                  <div className="mb-2 text-[10px] text-text-3 break-all whitespace-pre-wrap">
                    {JSON.stringify(tc.args, null, 2)}
                  </div>
                )}

                {decision === null ? (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => decide(idx, true)}
                      className="flex-1 py-1 text-[10px] border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/15 transition-colors tracking-widest"
                    >
                      ✓ APPROVE
                    </button>
                    <button
                      onClick={() => decide(idx, false)}
                      className="flex-1 py-1 text-[10px] border border-red-400/40 text-red-400 hover:bg-red-400/15 transition-colors tracking-widest"
                    >
                      ✗ DENY
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => decide(idx, null)}
                    className="mt-1 text-[9px] text-text-3 hover:text-text-1 transition-colors tracking-widest underline underline-offset-2"
                  >
                    [UNDO]
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-3 py-2 border-t border-orange-400/20 flex items-center gap-3">
          <span className="text-[10px] text-text-3 tracking-wider">
            {allDecided
              ? `${decisions.filter((d) => d === true).length} approved · ${decisions.filter((d) => d === false).length
              } denied`
              : `${decisions.filter((d) => d !== null).length} / ${calls.length} decided`}
          </span>

          <button
            onClick={handleConfirm}
            disabled={!allDecided}
            className="ml-auto px-4 py-1.5 text-[11px] font-bold tracking-widest border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-orange-400/60 text-orange-400 hover:bg-orange-400/15 disabled:hover:bg-transparent"
          >
            CONFIRM DECISIONS →
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgentBubble({ msg }: { msg: Message }) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] tracking-wider font-mono">
        <span className="text-accent">AGENT</span>
        <span>{msg.timestamp}</span>
      </div>

      <div className="max-w-[85%] p-3 border bg-accent/5 border-accent/20 text-text-1 font-mono text-sm">
        <span className="text-accent mr-2 float-left mt-0.5">{'>'}</span>

        <div className="ml-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <div className="mb-4 last:mb-0">{children}</div>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-4 space-y-1">{children}</ol>,
              pre: ({ children }) => <>{children}</>,
              script: () => null,
              code: ({ inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');

                if (!inline) {
                  return (
                    <div className="relative mt-2 mb-4 bg-bg-base border border-border-main overflow-hidden">
                      <div className="flex items-center px-3 py-1 bg-border-main/50 text-text-3 text-[10px] uppercase tracking-widest border-b border-border-main">
                        {match ? match[1] : 'code'}
                      </div>
                      <pre className="p-3 overflow-x-auto text-[13px] leading-relaxed">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  );
                }

                return (
                  <code
                    className="bg-accent/10 text-accent px-1.5 py-0.5 rounded-sm text-[0.9em]"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export function UserBubble({ msg }: { msg: Message }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] tracking-wider font-mono">
        <span>{msg.timestamp}</span>
        <span className="text-text-1">USER</span>
      </div>
      <div className="max-w-[85%] p-3 border bg-bg-surface border-border-main text-text-1 font-mono text-sm whitespace-pre-wrap">
        {msg.content}
      </div>
    </div>
  );
}

export function SystemBubble({ msg }: { msg: Message }) {
  return (
    <div className="flex flex-col items-start">
      <div
        className={`font-mono text-xs uppercase tracking-widest px-0 py-1 ${msg.isError ? 'text-red-400' : 'text-text-3'
          }`}
      >
        {msg.isError && '⚠ '}
        {msg.content}
      </div>
    </div>
  );
}
