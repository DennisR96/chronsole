'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { HistoryPanel } from '@/components/HistoryPanel';
import { useChatStore } from '@/store/chatStore';
import type { Conversation } from '@/store/chatStore';
import {
  AgentBubble,
  MemoryBubble,
  SystemBubble,
  ToolCallBubble,
  ToolConfirmBubble,
  ToolResultBubble,
  UserBubble,
} from './MessageBubbles';
import { ChatHeader } from './ChatHeader';
import { SettingsModal } from './SettingsModal';
import { StatusBar } from './StatusBar';
import { TypingIndicator } from './TypingIndicator';
import { UsageBar } from './UsageBar';
import type {
  AgentPhase,
  McpServerConfig,
  MemoryMode,
  Message,
  MessageRole,
  PendingToolCall,
  UsageState,
} from './types';
import {
  emptyUsage,
  findCutoffForLastUserMessages,
  formatToolSummary,
  keepLastUserMessages,
  makeBootMessages,
  makeMemorySummaryMessage,
  parseMcpServers,
  stripExistingMemorySummary,
  ts,
  uid,
} from './utils';

export default function AgentChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');

  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [toolCount, setToolCount] = useState(0);
  const [sessionUsage, setSessionUsage] = useState<UsageState>(emptyUsage);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet');
  const [workDir, setWorkDir] = useState('');
  const [mcpConfig, setMcpConfig] = useState('');
  const [isBrowsing, setIsBrowsing] = useState(false);

  const [memoryMode, setMemoryMode] = useState<MemoryMode>('off');
  const [memoryLastUserMessages, setMemoryLastUserMessages] = useState(8);
  const [memorySummaryKeepUserMessages, setMemorySummaryKeepUserMessages] = useState(4);

  const apiMessagesRef = useRef<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { activeId, newConversation, setActive, updateMessages, setTitle } = useChatStore();

  useEffect(() => {
    if (!activeId) return;

    const hasUserMessage = messages.some((m) => m.role === 'user');
    if (!hasUserMessage) return;

    updateMessages(activeId, messages as any[], apiMessagesRef.current);
  }, [messages, activeId, updateMessages]);

  useEffect(() => {
    if (!activeId) return;

    const conv = useChatStore.getState().conversations.find((c) => c.id === activeId);
    if (!conv || conv.title !== 'New session') return;

    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) return;

    const title = firstUser.content.slice(0, 42) + (firstUser.content.length > 42 ? '…' : '');
    setTitle(activeId, title);
  }, [messages, activeId, setTitle]);

  useEffect(() => {
    const k = localStorage.getItem('agent_api_key');
    const b = localStorage.getItem('agent_base_url');
    const m = localStorage.getItem('agent_model');
    const w = localStorage.getItem('agent_work_dir');
    const h = localStorage.getItem('agent_history_open');
    const mcp = localStorage.getItem('agent_mcp_servers');

    const memMode = localStorage.getItem('agent_memory_mode') as MemoryMode | null;
    const memLast = localStorage.getItem('agent_memory_last_user_messages');
    const memKeep = localStorage.getItem('agent_memory_summary_keep_user_messages');

    if (k) setApiKey(k);
    if (b) setBaseUrl(b);
    if (m) setModel(m);
    if (w) setWorkDir(w);
    if (h !== null) setIsHistoryOpen(h === 'true');
    if (mcp) setMcpConfig(mcp);

    if (memMode) setMemoryMode(memMode);
    if (memLast) setMemoryLastUserMessages(Number(memLast));
    if (memKeep) setMemorySummaryKeepUserMessages(Number(memKeep));

    const stored = useChatStore.getState();

    if (stored.activeId) {
      const conv = stored.getActive();

      if (conv && conv.messages.length > 0) {
        setMessages(conv.messages as any[]);
        apiMessagesRef.current = conv.apiMessages;
        return;
      }
    }

    setMessages(makeBootMessages());
    apiMessagesRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString('en-GB', {
          hour12: false,
        })
      );

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
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
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: uid(),
      },
    ]);
  }, []);

  const addOrReplaceMemoryMessage = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [
      ...prev.filter((m) => m.role !== 'memory'),
      {
        ...msg,
        id: uid(),
      },
    ]);
  }, []);

  const resetTransientSessionState = () => {
    setAgentPhase('idle');
    setToolCount(0);
    setSessionUsage(emptyUsage);
    setInputValue('');
  };

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      if (agentPhase !== 'idle') return;

      abortRef.current?.abort();

      setActive(conv.id);
      setMessages(conv.messages as any[]);
      apiMessagesRef.current = conv.apiMessages;

      resetTransientSessionState();
    },
    [agentPhase, setActive]
  );

  const handleNewConversation = useCallback(() => {
    abortRef.current?.abort();

    newConversation();

    setMessages(makeBootMessages());
    apiMessagesRef.current = [];

    resetTransientSessionState();
  }, [newConversation]);

  const compactMemoryIfNeeded = useCallback(async () => {
    if (memoryMode === 'off') return;

    const cleanMessages = stripExistingMemorySummary(apiMessagesRef.current);

    if (memoryMode === 'last_user_messages') {
      const before = cleanMessages.length;
      const compacted = keepLastUserMessages(cleanMessages, memoryLastUserMessages);

      apiMessagesRef.current = compacted;

      if (compacted.length < before) {
        addOrReplaceMemoryMessage({
          role: 'memory',
          content: `Manual memory mode is active. Older context was removed. The model now receives only the latest ${memoryLastUserMessages} user message(s), plus assistant/tool messages after that cutoff.`,
          timestamp: ts(),
          collapsed: false,
          memoryMode: 'last_user_messages',
        });
      }

      return;
    }

    if (memoryMode === 'summary') {
      const cutoff = findCutoffForLastUserMessages(
        cleanMessages,
        memorySummaryKeepUserMessages
      );

      const olderMessages = cleanMessages.slice(0, cutoff);
      const recentMessages = cleanMessages.slice(cutoff);

      if (olderMessages.length < 4) {
        apiMessagesRef.current = cleanMessages;
        return;
      }

      try {
        const res = await fetch('/api/agent-memory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: olderMessages,
            apiKey,
            baseUrl,
            model,
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          addMessage({
            role: 'system',
            content: `MEMORY SUMMARY ERROR: ${data.error ?? `HTTP ${res.status}`}`,
            timestamp: ts(),
            isError: true,
          });

          apiMessagesRef.current = cleanMessages;
          return;
        }

        apiMessagesRef.current = [
          makeMemorySummaryMessage(data.summary),
          ...recentMessages,
        ];

        if (data.usage) {
          setSessionUsage((prev) => ({
            promptTokens: prev.promptTokens + (data.usage.prompt_tokens ?? 0),
            completionTokens: prev.completionTokens + (data.usage.completion_tokens ?? 0),
            totalTokens: prev.totalTokens + (data.usage.total_tokens ?? 0),
            cost: prev.cost + (data.usage.cost ?? 0),
            llmCalls: prev.llmCalls + 1,
          }));
        }

        addOrReplaceMemoryMessage({
          role: 'memory',
          content: `Older context has been replaced with this summary. Recent ${memorySummaryKeepUserMessages} user message(s) are still kept verbatim.\n\n${data.summary}`,
          timestamp: ts(),
          collapsed: data.summary.length > 700,
          memoryMode: 'summary',
        });
      } catch (err: any) {
        addMessage({
          role: 'system',
          content: `MEMORY SUMMARY ERROR: ${err.message}`,
          timestamp: ts(),
          isError: true,
        });

        apiMessagesRef.current = cleanMessages;
      }
    }
  }, [
    memoryMode,
    memoryLastUserMessages,
    memorySummaryKeepUserMessages,
    apiKey,
    baseUrl,
    model,
    addMessage,
    addOrReplaceMemoryMessage,
  ]);

  const handleSSEEvent = useCallback((event: string, payload: any) => {
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
        const {
          assistantMessage,
          toolCalls,
          sessionUsage: updatedUsage,
        } = payload;

        if (updatedUsage) setSessionUsage(updatedUsage);

        if (assistantMessage) {
          apiMessagesRef.current = [
            ...apiMessagesRef.current,
            assistantMessage,
          ];
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
  }, []);

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
          headers: {
            'Content-Type': 'application/json',
          },
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

        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let buffer = '';
        let currentEvent = '';
        let currentData = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, {
            stream: true,
          });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              currentData = line.slice(5).trim();
            } else if (line === '' && currentEvent && currentData) {
              try {
                handleSSEEvent(currentEvent, JSON.parse(currentData));
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
    [
      apiKey,
      baseUrl,
      model,
      workDir,
      mcpConfig,
      sessionUsage,
      handleSSEEvent,
      addMessage,
    ]
  );

  const handleConfirmResolve = useCallback(
    (msgId: string, approved: PendingToolCall[], denied: PendingToolCall[]) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
              ...m,
              confirmResolved: true,
            }
            : m
        )
      );

      if (denied.length > 0) {
        const deniedResults = denied.map((tc) => ({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({
            error: 'Tool execution denied by user.',
          }),
        }));

        apiMessagesRef.current = [
          ...apiMessagesRef.current,
          ...deniedResults,
        ];

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

    if (!activeConv) newConversation();

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

    await compactMemoryIfNeeded();

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

    localStorage.setItem('agent_memory_mode', memoryMode);
    localStorage.setItem('agent_memory_last_user_messages', String(memoryLastUserMessages));
    localStorage.setItem(
      'agent_memory_summary_keep_user_messages',
      String(memorySummaryKeepUserMessages)
    );

    setIsSettingsOpen(false);

    addMessage({
      role: 'system',
      content: 'SYSTEM CONFIGURATION UPDATED. NEW PARAMETERS LOADED.',
      timestamp: ts(),
    });
  };

  const isIdle = agentPhase === 'idle';

  const mcpServerCount = (() => {
    try {
      return parseMcpServers(mcpConfig).filter((server) => server.enabled !== false).length;
    } catch {
      return 0;
    }
  })();

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
      <Sidebar activeTab="chat" />

      {isSettingsOpen && (
        <SettingsModal
          apiKey={apiKey}
          baseUrl={baseUrl}
          model={model}
          workDir={workDir}
          mcpConfig={mcpConfig}
          isBrowsing={isBrowsing}
          memoryMode={memoryMode}
          memoryLastUserMessages={memoryLastUserMessages}
          memorySummaryKeepUserMessages={memorySummaryKeepUserMessages}
          setApiKey={setApiKey}
          setBaseUrl={setBaseUrl}
          setModel={setModel}
          setWorkDir={setWorkDir}
          setMcpConfig={setMcpConfig}
          setMemoryMode={setMemoryMode}
          setMemoryLastUserMessages={setMemoryLastUserMessages}
          setMemorySummaryKeepUserMessages={setMemorySummaryKeepUserMessages}
          onBrowseFolder={handleBrowseFolder}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex-1 flex bg-bg-base relative overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <ChatHeader
              agentPhase={agentPhase}
              date={date}
              time={time}
              isHistoryOpen={isHistoryOpen}
              onNewConversation={handleNewConversation}
              onToggleHistory={toggleHistory}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            <UsageBar usage={sessionUsage} active={agentPhase !== 'idle'} />

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

                    case 'memory':
                      return (
                        <MemoryBubble
                          key={msg.id}
                          msg={msg}
                          onToggle={toggleCollapse}
                        />
                      );

                    case 'tool_call':
                      return <ToolCallBubble key={msg.id} msg={msg} />;

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
                    onClick={handleStop}
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

            <StatusBar
              agentPhase={agentPhase}
              model={model}
              toolCount={toolCount}
              workDir={workDir}
              mcpServerCount={mcpServerCount}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>

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
