"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Sidebar } from '@/components/Sidebar';
import { HistoryPanel } from '@/components/HistoryPanel';
import { useChatStore } from '@/store/chatStore';
import type { Conversation } from '@/store/chatStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole =
  | 'user'
  | 'agent'
  | 'system'
  | 'tool_call'
  | 'tool_result'
  | 'tool_confirm';

interface PendingToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolId?: string;
  isError?: boolean;
  collapsed?: boolean;
  pendingToolCalls?: PendingToolCall[];
  confirmResolved?: boolean;
}

interface UsageState {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  llmCalls: number;
}

interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ts = () =>
  new Date().toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function parseMcpServers(raw: string): McpServerConfig[] {
  if (!raw.trim()) return [];

  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('MCP config must be a JSON array.');
  }

  for (const [idx, server] of parsed.entries()) {
    if (!server || typeof server !== 'object') {
      throw new Error(`MCP server at index ${idx} must be an object.`);
    }

    if (typeof server.name !== 'string' || !server.name.trim()) {
      throw new Error(`MCP server at index ${idx} is missing a valid "name".`);
    }

    if (typeof server.command !== 'string' || !server.command.trim()) {
      throw new Error(`MCP server "${server.name}" is missing a valid "command".`);
    }

    if (server.args !== undefined && !Array.isArray(server.args)) {
      throw new Error(`MCP server "${server.name}" has invalid "args"; expected array.`);
    }

    if (
      server.env !== undefined &&
      (!server.env || typeof server.env !== 'object' || Array.isArray(server.env))
    ) {
      throw new Error(`MCP server "${server.name}" has invalid "env"; expected object.`);
    }
  }

  return parsed;
}

function formatMcpToolName(name: string): string {
  if (!name.startsWith('mcp__')) return name;

  const parts = name.split('__');

  if (parts.length >= 3) {
    return `MCP:${parts[1]} / ${parts.slice(2).join('__')}`;
  }

  return name;
}

function formatToolSummary(name: string, args: Record<string, unknown>): string {
  if (name.startsWith('mcp__')) {
    return `${formatMcpToolName(name)} ${JSON.stringify(args ?? {})}`;
  }

  switch (name) {
    case 'shell_execute':
      return `$ ${args.command}${args.working_directory ? `  [cwd: ${args.working_directory}]` : ''}`;
    case 'file_read':
      return `cat ${args.path}`;
    case 'file_write':
      return `write → ${args.path}${args.append ? ' (append)' : ''}`;
    case 'directory_list':
      return `ls ${args.path}${args.recursive ? ' -R' : ''}`;
    case 'file_delete':
      return `rm ${args.path}`;
    default:
      return JSON.stringify(args);
  }
}

function toolIcon(name: string): string {
  if (name.startsWith('mcp__')) return '🔌';

  const map: Record<string, string> = {
    shell_execute: '⌘',
    file_read: '📄',
    file_write: '✏️',
    directory_list: '📁',
    file_delete: '🗑',
  };

  return map[name] ?? '🔧';
}

function riskLevel(name: string, args: Record<string, unknown>): 'low' | 'medium' | 'high' {
  if (name.startsWith('mcp__')) return 'medium';

  if (name === 'file_delete') return 'high';

  if (name === 'shell_execute') {
    const cmd = String(args.command ?? '');
    if (/rm\s+-rf|sudo|chmod|chown|mkfs|dd\s/.test(cmd)) return 'high';
    if (/curl|wget|npm|pip|apt|brew/.test(cmd)) return 'medium';
    return 'medium';
  }

  if (name === 'file_write') return 'medium';

  return 'low';
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.00001) return '<$0.00001';
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToolCallBubble({ msg, onToggle }: { msg: Message; onToggle: (id: string) => void }) {
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

function ToolResultBubble({ msg, onToggle }: { msg: Message; onToggle: (id: string) => void }) {
  const isLong = msg.content.length > 400;
  const displayContent =
    msg.collapsed && isLong ? msg.content.slice(0, 400) + '…' : msg.content;

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

function ToolConfirmBubble({
  msg,
  onResolve,
}: {
  msg: Message;
  onResolve: (msgId: string, approved: PendingToolCall[], denied: PendingToolCall[]) => void;
}) {
  const calls = msg.pendingToolCalls ?? [];

  const [decisions, setDecisions] = useState<(boolean | null)[]>(() =>
    calls.map(() => null)
  );

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
          {denied.length > 0 && (
            <span className="text-red-400">✗ {denied.length} denied</span>
          )}
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

                  <span
                    className={`text-[9px] px-1.5 py-0.5 border font-bold tracking-widest ${colors.badge}`}
                  >
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

                {decision === null && (
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
                )}

                {decision !== null && (
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
            className="ml-auto px-4 py-1.5 text-[11px] font-bold tracking-widest border transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              border-orange-400/60 text-orange-400 hover:bg-orange-400/15 disabled:hover:bg-transparent"
          >
            CONFIRM DECISIONS →
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentBubble({ msg }: { msg: Message }) {
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

function UserBubble({ msg }: { msg: Message }) {
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

function SystemBubble({ msg }: { msg: Message }) {
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

function TypingIndicator({ phase }: { phase: 'thinking' | 'tool' | 'responding' }) {
  const labels = {
    thinking: 'Reasoning...',
    tool: 'Executing tool...',
    responding: 'Writing response...',
  };

  const colors = {
    thinking: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5',
    tool: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/5',
    responding: 'text-accent border-accent/20 bg-accent/5',
  };

  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2 mb-1 opacity-60 text-[10px] tracking-wider font-mono">
        <span
          className={
            phase === 'thinking'
              ? 'text-yellow-400'
              : phase === 'tool'
                ? 'text-emerald-400'
                : 'text-accent'
          }
        >
          {phase === 'thinking' ? 'THINKING' : phase === 'tool' ? 'TOOL' : 'AGENT'}
        </span>
      </div>

      <div className={`px-4 py-2 border font-mono text-sm animate-pulse ${colors[phase]}`}>
        <span className="mr-2">{'>'}</span>
        <span>{labels[phase]}</span>
        <span className="ml-1 animate-ping">_</span>
      </div>
    </div>
  );
}

function UsageBar({ usage, active }: { usage: UsageState; active: boolean }) {
  const hasData = usage.totalTokens > 0;

  return (
    <div
      className={`flex items-center h-9 px-4 gap-0 font-mono text-[10px] tracking-widest border-b border-border-main bg-bg-surface shrink-0 overflow-x-auto no-scrollbar transition-colors ${active ? 'border-yellow-400/20' : ''
        }`}
    >
      <div className="text-text-3 pr-4 border-r border-border-main whitespace-nowrap">
        SESSION_USAGE
      </div>

      <div className="flex items-center gap-1.5 px-4 border-r border-border-main whitespace-nowrap">
        <span className="text-text-3">IN</span>
        <span className={`font-bold ${hasData ? 'text-sky-400' : 'text-text-3'}`}>
          {formatTokens(usage.promptTokens)}
        </span>
        <span className="text-text-3 text-[9px]">tok</span>
      </div>

      <div className="flex items-center gap-1.5 px-4 border-r border-border-main whitespace-nowrap">
        <span className="text-text-3">OUT</span>
        <span className={`font-bold ${hasData ? 'text-violet-400' : 'text-text-3'}`}>
          {formatTokens(usage.completionTokens)}
        </span>
        <span className="text-text-3 text-[9px]">tok</span>
      </div>

      <div className="flex items-center gap-1.5 px-4 border-r border-border-main whitespace-nowrap">
        <span className="text-text-3">TOTAL</span>
        <span className={`font-bold ${hasData ? 'text-text-1' : 'text-text-3'}`}>
          {formatTokens(usage.totalTokens)}
        </span>
        <span className="text-text-3 text-[9px]">tok</span>
      </div>

      <div className="flex items-center gap-1.5 px-4 border-r border-border-main whitespace-nowrap">
        <span className="text-text-3">CALLS</span>
        <span className={`font-bold ${hasData ? 'text-text-1' : 'text-text-3'}`}>
          {usage.llmCalls}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-4 whitespace-nowrap">
        <span className="text-text-3">COST</span>
        <span
          className={`font-bold text-[11px] ${usage.cost > 0.1
              ? 'text-red-400'
              : usage.cost > 0.01
                ? 'text-yellow-400'
                : hasData
                  ? 'text-emerald-400'
                  : 'text-text-3'
            }`}
        >
          {formatCost(usage.cost)}
        </span>

        {active && <span className="text-yellow-400 animate-pulse text-[8px] ml-1">●</span>}
      </div>

      {hasData && (
        <div className="ml-auto pl-4 text-text-3 opacity-40 whitespace-nowrap hidden xl:block">
          accumulated this session
        </div>
      )}
    </div>
  );
}

// ─── Boot messages factory ────────────────────────────────────────────────────

function makeBootMessages(): Message[] {
  return [
    {
      id: uid(),
      role: 'system',
      content: 'INITIALIZING NEURAL LINK... ESTABLISHED.',
      timestamp: ts(),
    },
    {
      id: uid(),
      role: 'agent',
      content:
        'Agent framework active. I have access to your local machine, configured tools, and any enabled MCP servers. I can run shell commands, read/write files, inspect directories, and call MCP tools. **You will be asked to approve each tool call before it runs.** What would you like me to do?',
      timestamp: ts(),
    },
  ];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [agentPhase, setAgentPhase] = useState<
    'idle' | 'thinking' | 'tool' | 'responding' | 'awaiting_confirm'
  >('idle');

  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [toolCount, setToolCount] = useState(0);

  const [sessionUsage, setSessionUsage] = useState<UsageState>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cost: 0,
    llmCalls: 0,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet');
  const [workDir, setWorkDir] = useState('');
  const [mcpConfig, setMcpConfig] = useState('');
  const [isBrowsing, setIsBrowsing] = useState(false);

  const apiMessagesRef = useRef<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Zustand store ─────────────────────────────────────────────────────────
  const { activeId, newConversation, setActive, updateMessages, setTitle } = useChatStore();

  // ── Persist messages to store on every change ─────────────────────────────
  useEffect(() => {
    if (!activeId) return;

    const hasUserMessage = messages.some((m) => m.role === 'user');
    if (!hasUserMessage) return;

    updateMessages(activeId, messages as any[], apiMessagesRef.current);
  }, [messages, activeId, updateMessages]);

  // ── Auto-title conversation from first user message ───────────────────────
  useEffect(() => {
    if (!activeId) return;

    const conv = useChatStore.getState().conversations.find((c) => c.id === activeId);
    if (!conv || conv.title !== 'New session') return;

    const firstUser = messages.find((m) => m.role === 'user');

    if (firstUser) {
      const title =
        firstUser.content.slice(0, 42) + (firstUser.content.length > 42 ? '…' : '');

      setTitle(activeId, title);
    }
  }, [messages, activeId, setTitle]);

  // ── Mount: restore settings + last session ────────────────────────────────
  useEffect(() => {
    const k = localStorage.getItem('agent_api_key');
    const b = localStorage.getItem('agent_base_url');
    const m = localStorage.getItem('agent_model');
    const w = localStorage.getItem('agent_work_dir');
    const h = localStorage.getItem('agent_history_open');
    const mcp = localStorage.getItem('agent_mcp_servers');

    if (k) setApiKey(k);
    if (b) setBaseUrl(b);
    if (m) setModel(m);
    if (w) setWorkDir(w);
    if (h !== null) setIsHistoryOpen(h === 'true');
    if (mcp) setMcpConfig(mcp);

    const stored = useChatStore.getState();

    if (stored.activeId) {
      const conv = stored.getActive();

      if (conv && conv.messages.length > 0) {
        setMessages(conv.messages as any[]);
        apiMessagesRef.current = conv.apiMessages;
        return;
      }
    }

    // No saved session to restore.
    // Do NOT create a new conversation here, otherwise reloads create history spam.
    setMessages(makeBootMessages());
    apiMessagesRef.current = [];

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();

      setTime(now.toLocaleTimeString('en-GB', { hour12: false }));

      setDate(
        now
          .toLocaleDateString('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          })
          .replace(/\//g, '.')
      );
    };

    tick();

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentPhase]);

  const toggleHistory = useCallback(() => {
    setIsHistoryOpen((prev) => {
      const next = !prev;
      localStorage.setItem('agent_history_open', String(next));
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, collapsed: !m.collapsed } : m))
    );
  }, []);

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: uid() }]);
  }, []);

  // ── Load a conversation from history ──────────────────────────────────────
  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      if (agentPhase !== 'idle') return;

      abortRef.current?.abort();

      setActive(conv.id);
      setMessages(conv.messages as any[]);
      apiMessagesRef.current = conv.apiMessages;

      setAgentPhase('idle');
      setToolCount(0);
      setSessionUsage({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        llmCalls: 0,
      });
      setInputValue('');
    },
    [agentPhase, setActive]
  );

  // ── Start a brand-new conversation ───────────────────────────────────────
  const handleNewConversation = useCallback(() => {
    abortRef.current?.abort();

    newConversation();

    setMessages(makeBootMessages());
    apiMessagesRef.current = [];

    setAgentPhase('idle');
    setToolCount(0);
    setSessionUsage({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      llmCalls: 0,
    });
    setInputValue('');
  }, [newConversation]);

  // ── SSE event handler ─────────────────────────────────────────────────────
  const handleSSEEvent = useCallback(
    (event: string, payload: any) => {
      switch (event) {
        case 'usage_update': {
          setSessionUsage({
            promptTokens: payload.promptTokens ?? 0,
            completionTokens: payload.completionTokens ?? 0,
            totalTokens: payload.totalTokens ?? 0,
            cost: payload.cost ?? 0,
            llmCalls: payload.llmCalls ?? 0,
          });
          break;
        }

        case 'tool_executing': {
          setAgentPhase('tool');
          setToolCount((n) => n + 1);

          const summary = formatToolSummary(payload.name, payload.args ?? {});

          setMessages((prev) => [
            ...prev,
            {
              id: payload.id ?? uid(),
              role: 'tool_call' as MessageRole,
              content: summary,
              timestamp: ts(),
              toolName: payload.name,
              toolArgs: payload.args,
              toolId: payload.id,
            },
          ]);

          break;
        }

        case 'tool_result': {
          setAgentPhase('responding');

          apiMessagesRef.current = [
            ...apiMessagesRef.current,
            {
              role: 'tool',
              tool_call_id: payload.id,
              content: payload.result ?? '',
            },
          ];

          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'tool_result' as MessageRole,
              content: payload.result ?? '',
              timestamp: ts(),
              toolName: payload.name,
              toolId: payload.id,
              collapsed: (payload.result?.length ?? 0) > 400,
            },
          ]);

          break;
        }

        case 'tools_pending': {
          const { assistantMessage, toolCalls, sessionUsage: updatedUsage } = payload;

          if (updatedUsage) setSessionUsage(updatedUsage);

          if (assistantMessage) {
            apiMessagesRef.current = [...apiMessagesRef.current, assistantMessage];
          }

          setAgentPhase('awaiting_confirm');

          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'tool_confirm' as MessageRole,
              content: '',
              timestamp: ts(),
              pendingToolCalls: toolCalls,
              confirmResolved: false,
            },
          ]);

          break;
        }

        case 'agent_message': {
          apiMessagesRef.current = [
            ...apiMessagesRef.current,
            {
              role: 'assistant',
              content: payload.content ?? '',
            },
          ];

          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'agent' as MessageRole,
              content: payload.content ?? '',
              timestamp: ts(),
            },
          ]);

          break;
        }

        case 'error': {
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: 'system' as MessageRole,
              content: `AGENT ERROR: ${payload.message}`,
              timestamp: ts(),
              isError: true,
            },
          ]);

          setAgentPhase('idle');
          break;
        }

        case 'done': {
          setAgentPhase('idle');
          break;
        }
      }
    },
    []
  );

  // ── Core agentic step ─────────────────────────────────────────────────────
  const runStep = useCallback(
    async (pendingToolResults?: Array<{ id: string; name: string; args: any }>) => {
      const abort = new AbortController();
      abortRef.current = abort;

      let parsedMcpServers: McpServerConfig[] = [];

      try {
        parsedMcpServers = parseMcpServers(mcpConfig);
      } catch (err: any) {
        addMessage({
          role: 'system',
          content: `MCP CONFIG ERROR: ${err.message}`,
          timestamp: ts(),
          isError: true,
        });

        setAgentPhase('idle');
        abortRef.current = null;
        return;
      }

      try {
        const res = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessagesRef.current,
            apiKey,
            baseUrl,
            model,
            pendingToolResults: pendingToolResults ?? null,
            sessionUsage,
            workDir: workDir.trim() || null,
            mcpServers: parsedMcpServers,
          }),
          signal: abort.signal,
        });

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let currentEvent = '';
        let currentData = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              currentData = line.slice(5).trim();
            } else if (line === '' && currentEvent && currentData) {
              try {
                const payload = JSON.parse(currentData);
                handleSSEEvent(currentEvent, payload);
              } catch {
                // Ignore malformed SSE payloads.
              }

              currentEvent = '';
              currentData = '';
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          addMessage({
            role: 'system',
            content: `NETWORK ERROR: ${err.message}`,
            timestamp: ts(),
            isError: true,
          });

          setAgentPhase('idle');
        }
      } finally {
        abortRef.current = null;
      }
    },
    [apiKey, baseUrl, model, workDir, mcpConfig, sessionUsage, handleSSEEvent, addMessage]
  );

  // ── Confirm resolve ───────────────────────────────────────────────────────
  const handleConfirmResolve = useCallback(
    (msgId: string, approved: PendingToolCall[], denied: PendingToolCall[]) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, confirmResolved: true } : m))
      );

      if (denied.length > 0) {
        const deniedResults = denied.map((tc) => ({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: 'Tool execution denied by user.' }),
        }));

        apiMessagesRef.current = [...apiMessagesRef.current, ...deniedResults];

        setMessages((prev) => [
          ...prev,
          ...denied.map((tc) => ({
            id: uid(),
            role: 'tool_result' as MessageRole,
            content: '{ "error": "Tool execution denied by user." }',
            timestamp: ts(),
            toolName: tc.name,
            toolId: tc.id,
            collapsed: false,
          })),
        ]);
      }

      if (approved.length > 0 || denied.length > 0) {
        setAgentPhase('tool');
        runStep(approved.length > 0 ? approved : []);
      } else {
        setAgentPhase('idle');
      }
    },
    [runStep]
  );

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || agentPhase !== 'idle') return;

    if (!apiKey) {
      addMessage({
        role: 'system',
        content: 'ERROR: API KEY NOT CONFIGURED. OPEN CONFIG TO SET YOUR KEY.',
        timestamp: ts(),
        isError: true,
      });
      return;
    }

    const store = useChatStore.getState();

    const activeConv = store.activeId
      ? store.conversations.find((c) => c.id === store.activeId)
      : null;

    // Create a stored conversation only when the user actually sends something.
    // This prevents reloads from creating empty sessions.
    if (!activeConv) {
      newConversation();
    }

    const userContent = inputValue.trim();

    setInputValue('');

    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'user',
        content: userContent,
        timestamp: ts(),
      },
    ]);

    apiMessagesRef.current = [
      ...apiMessagesRef.current,
      {
        role: 'user',
        content: userContent,
      },
    ];

    setAgentPhase('thinking');
    setToolCount(0);

    await runStep();
  };

  const handleStop = () => {
    abortRef.current?.abort();

    setAgentPhase('idle');

    addMessage({
      role: 'system',
      content: 'AGENT INTERRUPTED BY USER.',
      timestamp: ts(),
    });
  };

  // ── Native folder picker ──────────────────────────────────────────────────
  const handleBrowseFolder = async () => {
    setIsBrowsing(true);

    try {
      const res = await fetch('/api/pick-folder');
      const data = await res.json();

      if (data.path) {
        setWorkDir(data.path);
      } else if (data.error) {
        addMessage({
          role: 'system',
          content: `FOLDER PICKER ERROR: ${data.error}`,
          timestamp: ts(),
          isError: true,
        });
      }
    } catch (err: any) {
      addMessage({
        role: 'system',
        content: `FOLDER PICKER ERROR: ${err.message}`,
        timestamp: ts(),
        isError: true,
      });
    } finally {
      setIsBrowsing(false);
    }
  };

  // ── Save settings ─────────────────────────────────────────────────────────
  const handleSaveSettings = () => {
    try {
      parseMcpServers(mcpConfig);
    } catch (err: any) {
      addMessage({
        role: 'system',
        content: `MCP CONFIG ERROR: ${err.message}`,
        timestamp: ts(),
        isError: true,
      });

      return;
    }

    localStorage.setItem('agent_api_key', apiKey);
    localStorage.setItem('agent_base_url', baseUrl);
    localStorage.setItem('agent_model', model);
    localStorage.setItem('agent_work_dir', workDir);
    localStorage.setItem('agent_mcp_servers', mcpConfig);

    setIsSettingsOpen(false);

    addMessage({
      role: 'system',
      content: 'SYSTEM CONFIGURATION UPDATED. NEW PARAMETERS LOADED.',
      timestamp: ts(),
    });
  };

  const isIdle = agentPhase === 'idle';

  const workDirLabel = workDir.trim()
    ? workDir.trim().split(/[\\/]/).filter(Boolean).pop()?.toUpperCase() ?? workDir.trim()
    : null;

  const mcpServerCount = (() => {
    try {
      return parseMcpServers(mcpConfig).filter((server) => server.enabled !== false).length;
    } catch {
      return 0;
    }
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
      <Sidebar activeTab="chat" />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-mono">
          <div className="bg-bg-surface border border-accent/50 w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-6 shadow-[0_0_20px_rgba(var(--color-accent),0.15)]">
            <div className="flex items-center justify-between border-b border-border-main pb-4 mb-6">
              <h2 className="text-accent font-bold tracking-widest uppercase">
                System Configuration
              </h2>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-text-3 hover:text-accent transition-colors"
              >
                [X]
              </button>
            </div>

            <div className="space-y-5">
              {[
                {
                  label: 'API Key',
                  prefix: '#',
                  value: apiKey,
                  setter: setApiKey,
                  type: 'password',
                  placeholder: 'sk-...',
                },
                {
                  label: 'Base URL',
                  prefix: '@',
                  value: baseUrl,
                  setter: setBaseUrl,
                  type: 'text',
                  placeholder: 'https://openrouter.ai/api/v1',
                },
                {
                  label: 'Model',
                  prefix: '~',
                  value: model,
                  setter: setModel,
                  type: 'text',
                  placeholder: 'anthropic/claude-3.5-sonnet',
                },
              ].map(({ label, prefix, value, setter, type, placeholder }) => (
                <div key={label} className="space-y-2">
                  <label className="text-[11px] text-text-2 tracking-widest uppercase">
                    {label}
                  </label>

                  <div className="relative flex items-center bg-bg-base border border-border-main focus-within:border-accent transition-colors">
                    <span className="absolute left-3 text-accent text-sm opacity-70">
                      {prefix}
                    </span>

                    <input
                      type={type}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-transparent border-none outline-none py-2 pl-8 pr-4 text-sm text-text-1 placeholder:text-text-3"
                    />
                  </div>
                </div>
              ))}

              <div className="space-y-2">
                <label className="text-[11px] text-text-2 tracking-widest uppercase">
                  Work Directory
                </label>

                <div className="flex gap-2 items-stretch">
                  <div className="flex-1 relative flex items-center bg-bg-base border border-border-main focus-within:border-accent transition-colors">
                    <span className="absolute left-3 text-accent text-sm opacity-70">/</span>

                    <input
                      type="text"
                      value={workDir}
                      onChange={(e) => setWorkDir(e.target.value)}
                      placeholder="/home/user/projects/myapp"
                      className="w-full bg-transparent border-none outline-none py-2 pl-8 pr-4 text-sm text-text-1 placeholder:text-text-3"
                    />

                    {workDir && (
                      <button
                        onClick={() => setWorkDir('')}
                        title="Clear"
                        className="absolute right-2 text-text-3 hover:text-red-400 transition-colors text-[11px] px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleBrowseFolder}
                    disabled={isBrowsing}
                    title="Open folder picker"
                    className="shrink-0 px-3 border border-border-main text-text-2 hover:border-accent hover:text-accent
                      disabled:opacity-50 disabled:cursor-wait transition-colors font-mono text-[11px] tracking-widest
                      flex items-center gap-1.5"
                  >
                    {isBrowsing ? (
                      <>
                        <span className="animate-spin inline-block">⟳</span>
                        <span className="hidden sm:inline">OPENING…</span>
                      </>
                    ) : (
                      <>
                        <span>📁</span>
                        <span className="hidden sm:inline">BROWSE</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[10px] text-text-3 tracking-wider leading-relaxed">
                  Shell commands run from this directory by default. Relative paths are resolved
                  against it. Leave empty to use the server process cwd.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-text-2 tracking-widest uppercase">
                  MCP Servers
                </label>

                <div className="relative bg-bg-base border border-border-main focus-within:border-accent transition-colors">
                  <textarea
                    value={mcpConfig}
                    onChange={(e) => setMcpConfig(e.target.value)}
                    placeholder={`[
  {
    "name": "filesystem",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
    "enabled": true
  }
]`}
                    rows={10}
                    className="w-full bg-transparent border-none outline-none p-3 text-xs text-text-1 placeholder:text-text-3 font-mono resize-y"
                  />
                </div>

                <p className="text-[10px] text-text-3 tracking-wider leading-relaxed">
                  JSON array of stdio MCP servers. Each server can define name, command, args,
                  env, and enabled. MCP tools are exposed as mcp__server__tool and still require
                  approval.
                </p>
              </div>
            </div>

            <div className="mt-6 p-3 border border-yellow-400/20 bg-yellow-400/5 text-yellow-400/70 text-[11px] tracking-wider">
              ⚠ This agent can execute shell commands and call configured MCP tools. Only connect
              to trusted models, APIs, and MCP servers.
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSaveSettings}
                className="flex-1 py-2 bg-accent text-bg-base text-sm font-bold tracking-widest hover:opacity-90 transition-opacity border border-accent"
              >
                SAVE_PARAMS
              </button>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 py-2 bg-transparent text-text-1 text-sm font-bold tracking-widest hover:bg-border-main transition-colors border border-border-main"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex-1 flex bg-bg-base relative overflow-hidden">
          {/* Chat column */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="flex h-12 bg-bg-surface shrink-0 items-end px-4 gap-2 overflow-x-auto no-scrollbar border-b border-border-main justify-between">
              <div className="flex items-center h-full pr-6 text-sm font-bold tracking-widest text-text-1 border-r border-border-main">
                CHRONOSOLE // AGENT_COMM
              </div>

              <div className="hidden lg:flex items-center h-full px-4 gap-6 font-mono text-[11px] text-text-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[8px] ${agentPhase !== 'idle'
                        ? 'text-yellow-400 animate-pulse'
                        : 'text-emerald-400'
                      }`}
                  >
                    ■
                  </span>

                  <span
                    className={`tracking-wider ${agentPhase === 'awaiting_confirm'
                        ? 'text-orange-400'
                        : agentPhase !== 'idle'
                          ? 'text-yellow-400'
                          : 'text-emerald-400'
                      }`}
                  >
                    {agentPhase === 'awaiting_confirm'
                      ? 'AWAITING CONFIRM'
                      : agentPhase !== 'idle'
                        ? agentPhase.toUpperCase()
                        : 'STANDBY'}
                  </span>
                </div>

                <div className="tracking-wider">
                  {date} // {time}
                </div>

                <button
                  onClick={handleNewConversation}
                  className="hover:text-accent transition-colors tracking-wider flex items-center gap-1.5"
                >
                  <span className="text-accent">+</span> NEW
                </button>

                <button
                  onClick={toggleHistory}
                  className="hover:text-accent transition-colors tracking-wider flex items-center gap-1.5"
                >
                  <span className="text-accent">{isHistoryOpen ? '−' : '+'}</span>
                  HISTORY
                </button>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="hover:text-accent transition-colors tracking-wider flex items-center gap-2"
                >
                  <span className="text-accent text-[10px]">⚙</span> CONFIG
                </button>

                <ThemeToggle />
              </div>
            </div>

            <UsageBar usage={sessionUsage} active={agentPhase !== 'idle'} />

            {/* Messages */}
            <div className="flex-1 relative bg-bg-base overflow-y-auto p-4 sm:p-6 font-mono text-sm leading-relaxed scroll-smooth">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((msg) => {
                  switch (msg.role) {
                    case 'user':
                      return <UserBubble key={msg.id} msg={msg} />;

                    case 'agent':
                      return <AgentBubble key={msg.id} msg={msg} />;

                    case 'system':
                      return <SystemBubble key={msg.id} msg={msg} />;

                    case 'tool_call':
                      return (
                        <ToolCallBubble
                          key={msg.id}
                          msg={msg}
                          onToggle={toggleCollapse}
                        />
                      );

                    case 'tool_result':
                      return (
                        <ToolResultBubble
                          key={msg.id}
                          msg={msg}
                          onToggle={toggleCollapse}
                        />
                      );

                    case 'tool_confirm':
                      return (
                        <ToolConfirmBubble
                          key={msg.id}
                          msg={msg}
                          onResolve={handleConfirmResolve}
                        />
                      );

                    default:
                      return null;
                  }
                })}

                {agentPhase !== 'idle' && agentPhase !== 'awaiting_confirm' && (
                  <TypingIndicator
                    phase={
                      agentPhase === 'thinking'
                        ? 'thinking'
                        : agentPhase === 'tool'
                          ? 'tool'
                          : 'responding'
                    }
                  />
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <div className="p-4 bg-bg-surface border-t border-border-main shrink-0">
              <div className="max-w-4xl mx-auto flex items-end gap-3">
                <div className="flex-1 relative flex items-center bg-bg-base border border-border-main focus-within:border-accent transition-colors">
                  <span className="absolute left-4 text-accent font-mono text-sm opacity-70">
                    {'>'}
                  </span>

                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && isIdle) {
                        e.preventDefault();
                        handleSendMessage(e as any);
                      }
                    }}
                    placeholder={
                      agentPhase === 'awaiting_confirm'
                        ? 'Approve or deny tool calls above…'
                        : isIdle
                          ? 'Enter command or query...'
                          : 'Agent is running…'
                    }
                    disabled={!isIdle}
                    className="w-full bg-transparent border-none outline-none py-3 pl-10 pr-4 text-sm font-mono text-text-1 placeholder:text-text-3 disabled:opacity-50"
                    autoFocus
                  />
                </div>

                {isIdle ? (
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    className="px-6 py-3 bg-accent text-bg-base font-mono text-sm font-bold tracking-widest hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity border border-accent"
                  >
                    EXECUTE
                  </button>
                ) : agentPhase === 'awaiting_confirm' ? (
                  <button
                    onClick={() => {
                      setAgentPhase('idle');
                      addMessage({
                        role: 'system',
                        content: 'AGENT INTERRUPTED BY USER.',
                        timestamp: ts(),
                      });
                    }}
                    className="px-6 py-3 bg-orange-500/20 text-orange-400 font-mono text-sm font-bold tracking-widest hover:bg-orange-500/30 transition-colors border border-orange-400/40"
                  >
                    ABORT
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="px-6 py-3 bg-red-500/20 text-red-400 font-mono text-sm font-bold tracking-widest hover:bg-red-500/30 transition-colors border border-red-400/40 animate-pulse"
                  >
                    ABORT
                  </button>
                )}
              </div>
            </div>

            {/* Status bar */}
            <div className="flex h-8 border-t border-border-main bg-bg-surface shrink-0 items-center px-4 justify-between font-mono text-[11px] text-text-3 tracking-widest overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-6 whitespace-nowrap">
                <div>
                  MODEL:{' '}
                  <span className="text-accent font-bold">
                    {model.split('/').pop()?.toUpperCase() ?? 'UNKNOWN'}
                  </span>
                </div>

                <div>
                  TOOLS:{' '}
                  <span className="text-text-1 font-bold">
                    {toolCount > 0 ? `${toolCount} CALLS` : 'READY'}
                  </span>
                </div>

                {workDirLabel && (
                  <div className="flex items-center gap-1.5 pl-6 border-l border-border-main">
                    <span className="text-text-3">/</span>

                    <span
                      className="text-sky-400 font-bold cursor-pointer hover:text-sky-300 transition-colors"
                      title={workDir}
                      onClick={() => setIsSettingsOpen(true)}
                    >
                      {workDirLabel}
                    </span>
                  </div>
                )}

                {mcpServerCount > 0 && (
                  <div className="flex items-center gap-1.5 pl-6 border-l border-border-main">
                    <span className="text-text-3">🔌</span>
                    <span
                      className="text-violet-400 font-bold cursor-pointer hover:text-violet-300 transition-colors"
                      title="Configured MCP servers"
                      onClick={() => setIsSettingsOpen(true)}
                    >
                      MCP:{mcpServerCount}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-4 pl-6 border-l border-border-main">
                  <div className="flex items-center gap-2">
                    <span className="border border-border-main px-1.5 rounded text-text-1 bg-bg-base">
                      ↵
                    </span>
                    SEND
                  </div>

                  <div className="text-yellow-400/60">⌘ SHELL • 📁 FS • ✏️ WRITE • 🔌 MCP</div>
                </div>
              </div>

              <div className="flex items-center gap-2 whitespace-nowrap pl-4">
                <span
                  className={`text-[10px] ${agentPhase === 'awaiting_confirm'
                      ? 'text-orange-400 animate-pulse'
                      : agentPhase !== 'idle'
                        ? 'text-yellow-400 animate-pulse'
                        : 'text-emerald-400'
                    }`}
                >
                  ∿
                </span>

                {agentPhase === 'awaiting_confirm'
                  ? 'AWAITING CONFIRM'
                  : agentPhase !== 'idle'
                    ? agentPhase.toUpperCase()
                    : 'IDLE'}
              </div>
            </div>
          </div>

          {/* History panel */}
          {isHistoryOpen ? (
            <div className="shrink-0 border-l border-border-main bg-bg-surface">
              <HistoryPanel
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
              />
            </div>
          ) : (
            <button
              onClick={toggleHistory}
              title="Open history"
              className="absolute right-3 top-16 z-30 px-2 py-1 border border-border-main bg-bg-surface text-text-3 hover:text-accent hover:border-accent transition-colors font-mono text-[10px] tracking-widest"
            >
              HISTORY
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
