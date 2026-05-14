import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { MemoryMode } from './types';

type Props = {
  apiKey: string;
  baseUrl: string;
  model: string;
  workDir: string;
  mcpConfig: string;
  isBrowsing: boolean;

  memoryMode: MemoryMode;
  memoryLastUserMessages: number;
  memorySummaryKeepUserMessages: number;

  setApiKey: Dispatch<SetStateAction<string>>;
  setBaseUrl: Dispatch<SetStateAction<string>>;
  setModel: Dispatch<SetStateAction<string>>;
  setWorkDir: Dispatch<SetStateAction<string>>;
  setMcpConfig: Dispatch<SetStateAction<string>>;

  setMemoryMode: Dispatch<SetStateAction<MemoryMode>>;
  setMemoryLastUserMessages: Dispatch<SetStateAction<number>>;
  setMemorySummaryKeepUserMessages: Dispatch<SetStateAction<number>>;

  onBrowseFolder: () => void;
  onSave: () => void;
  onClose: () => void;
};

type SettingsTab = 'model' | 'memory' | 'workspace' | 'mcp';

type ProviderModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  } | Array<{
    prompt?: string;
    completion?: string;
  }>;
  supported_parameters?: string[];
};

type ModelsFetchState =
  | { status: 'idle'; error?: string }
  | { status: 'loading'; error?: string }
  | { status: 'ready'; error?: string }
  | { status: 'error'; error: string };

const TABS: Array<{
  id: SettingsTab;
  label: string;
  icon: string;
}> = [
    { id: 'model', label: 'MODEL', icon: '~' },
    { id: 'memory', label: 'MEMORY', icon: '◈' },
    { id: 'workspace', label: 'WORKSPACE', icon: '/' },
    { id: 'mcp', label: 'MCP', icon: '🔌' },
  ];

export function SettingsModal({
  apiKey,
  baseUrl,
  model,
  workDir,
  mcpConfig,
  isBrowsing,

  memoryMode,
  memoryLastUserMessages,
  memorySummaryKeepUserMessages,

  setApiKey,
  setBaseUrl,
  setModel,
  setWorkDir,
  setMcpConfig,

  setMemoryMode,
  setMemoryLastUserMessages,
  setMemorySummaryKeepUserMessages,

  onBrowseFolder,
  onSave,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('model');

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-mono">
      <div className="bg-bg-surface border border-accent/50 w-full max-w-2xl max-h-[90dvh] flex flex-col shadow-[0_0_20px_rgba(var(--color-accent),0.15)]">
        <div className="flex items-center justify-between border-b border-border-main px-6 py-4 shrink-0">
          <div>
            <h2 className="text-accent font-bold tracking-widest uppercase">
              System Configuration
            </h2>
            <p className="mt-1 text-[10px] text-text-3 tracking-wider uppercase">
              Configure runtime, memory, workspace, and tool servers
            </p>
          </div>

          <button onClick={onClose} className="text-text-3 hover:text-accent transition-colors">
            [X]
          </button>
        </div>

        <div className="flex border-b border-border-main bg-bg-base/40 shrink-0 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-[11px] tracking-widest border-r border-border-main transition-colors whitespace-nowrap ${isActive
                  ? 'text-accent bg-accent/10'
                  : 'text-text-3 hover:text-text-1 hover:bg-border-main/40'
                  }`}
              >
                <span className="mr-2 opacity-80">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'model' && (
            <div className="space-y-5">
              <SectionIntro
                title="Model Runtime"
                description="Connection settings for the OpenAI-compatible chat endpoint."
              />

              <TextField
                label="API Key"
                prefix="#"
                value={apiKey}
                type="password"
                placeholder="sk-..."
                onChange={setApiKey}
              />

              <TextField
                label="Base URL"
                prefix="@"
                value={baseUrl}
                type="text"
                placeholder="https://openrouter.ai/api/v1"
                onChange={setBaseUrl}
              />

              <ModelPicker
                apiKey={apiKey}
                baseUrl={baseUrl}
                model={model}
                setModel={setModel}
              />
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="space-y-5">
              <SectionIntro
                title="Conversation Memory"
                description="Control how much prior context is sent back to the model."
              />

              <div className="space-y-3 border border-border-main bg-bg-base/40 p-3">
                <div>
                  <label className="text-[11px] text-text-2 tracking-widest uppercase">
                    Memory Mode
                  </label>

                  <select
                    value={memoryMode}
                    onChange={(e) => setMemoryMode(e.target.value as MemoryMode)}
                    className="mt-2 w-full bg-bg-base border border-border-main outline-none py-2 px-3 text-sm text-text-1 focus:border-accent"
                  >
                    <option value="off">OFF</option>
                    <option value="summary">LLM SUMMARY</option>
                    <option value="last_user_messages">LAST USER MESSAGES</option>
                  </select>
                </div>

                {memoryMode === 'off' && (
                  <p className="text-[10px] text-text-3 tracking-wider leading-relaxed">
                    Memory compaction is disabled. The full available conversation context is sent
                    until the model or API limit is reached.
                  </p>
                )}

                {memoryMode === 'last_user_messages' && (
                  <div className="space-y-2">
                    <label className="text-[11px] text-text-2 tracking-widest uppercase">
                      Keep Last User Messages
                    </label>

                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={memoryLastUserMessages}
                      onChange={(e) =>
                        setMemoryLastUserMessages(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full bg-bg-base border border-border-main outline-none py-2 px-3 text-sm text-text-1 focus:border-accent"
                    />

                    <p className="text-[10px] text-text-3 tracking-wider leading-relaxed">
                      The model receives only the latest N user turns and the assistant/tool messages
                      after that point.
                    </p>
                  </div>
                )}

                {memoryMode === 'summary' && (
                  <div className="space-y-2">
                    <label className="text-[11px] text-text-2 tracking-widest uppercase">
                      Keep Recent User Messages Verbatim
                    </label>

                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={memorySummaryKeepUserMessages}
                      onChange={(e) =>
                        setMemorySummaryKeepUserMessages(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full bg-bg-base border border-border-main outline-none py-2 px-3 text-sm text-text-1 focus:border-accent"
                    />

                    <p className="text-[10px] text-text-3 tracking-wider leading-relaxed">
                      Older context is replaced by an LLM-generated memory summary. Recent turns
                      remain intact.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div className="space-y-5">
              <SectionIntro
                title="Workspace"
                description="Set the default directory used by shell commands and relative file paths."
              />

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
                    onClick={onBrowseFolder}
                    disabled={isBrowsing}
                    title="Open folder picker"
                    className="shrink-0 px-3 border border-border-main text-text-2 hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-wait transition-colors font-mono text-[11px] tracking-widest flex items-center gap-1.5"
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
            </div>
          )}

          {activeTab === 'mcp' && (
            <div className="space-y-5">
              <SectionIntro
                title="MCP Servers"
                description="Configure stdio MCP servers exposed to the agent as approval-gated tools."
              />

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
                    rows={14}
                    className="w-full bg-transparent border-none outline-none p-3 text-xs text-text-1 placeholder:text-text-3 font-mono resize-y"
                  />
                </div>

                <p className="text-[10px] text-text-3 tracking-wider leading-relaxed">
                  JSON array of stdio MCP servers. Each server can define name, command, args, env,
                  and enabled. MCP tools are exposed as mcp__server__tool and still require
                  approval.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border-main p-4 shrink-0">
          <div className="mb-4 p-3 border border-yellow-400/20 bg-yellow-400/5 text-yellow-400/70 text-[11px] tracking-wider">
            ⚠ This agent can execute shell commands and call configured MCP tools. Only connect to
            trusted models, APIs, and MCP servers.
          </div>

          <div className="flex gap-3">
            <button
              onClick={onSave}
              className="flex-1 py-2 bg-accent text-bg-base text-sm font-bold tracking-widest hover:opacity-90 transition-opacity border border-accent"
            >
              SAVE_PARAMS
            </button>

            <button
              onClick={onClose}
              className="flex-1 py-2 bg-transparent text-text-1 text-sm font-bold tracking-widest hover:bg-border-main transition-colors border border-border-main"
            >
              CANCEL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelPicker({
  apiKey,
  baseUrl,
  model,
  setModel,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  setModel: Dispatch<SetStateAction<string>>;
}) {
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [query, setQuery] = useState('');
  const [fetchState, setFetchState] = useState<ModelsFetchState>({ status: 'idle' });
  const [isOpen, setIsOpen] = useState(false);

  const modelsUrl = useMemo(() => makeModelsUrl(baseUrl), [baseUrl]);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === model),
    [models, model]
  );

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return models.slice(0, 80);

    return models
      .filter((item) => {
        const haystack = [
          item.id,
          item.name,
          item.description,
          item.supported_parameters?.join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(q);
      })
      .slice(0, 80);
  }, [models, query]);

  const loadModels = async () => {
    if (!modelsUrl) {
      setFetchState({
        status: 'error',
        error: 'Base URL is empty.',
      });
      return;
    }

    setFetchState({ status: 'loading' });

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };

      if (apiKey.trim()) {
        headers.Authorization = `Bearer ${apiKey.trim()}`;
      }

      const res = await fetch(modelsUrl, {
        method: 'GET',
        headers,
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          payload?.error?.message ??
          payload?.message ??
          `HTTP ${res.status}`
        );
      }

      const normalized = normalizeModels(payload);

      if (normalized.length === 0) {
        throw new Error('No models found in response.');
      }

      setModels(normalized);
      setFetchState({ status: 'ready' });
    } catch (err: any) {
      setFetchState({
        status: 'error',
        error: err?.message ?? 'Failed to fetch models.',
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (models.length > 0) return;

    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const selectedPricing = selectedModel ? getLowestPricing(selectedModel) : null;
  const selectedContext = selectedModel
    ? formatContextLength(selectedModel.context_length)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[11px] text-text-2 tracking-widest uppercase">
          Model
        </label>

        <button
          type="button"
          onClick={loadModels}
          disabled={fetchState.status === 'loading'}
          className="text-[10px] text-text-3 hover:text-accent disabled:opacity-50 disabled:cursor-wait transition-colors tracking-widest"
        >
          {fetchState.status === 'loading' ? 'SYNCING…' : 'SYNC MODELS'}
        </button>
      </div>

      <div className="relative">
        <div className="relative flex items-center bg-bg-base border border-border-main focus-within:border-accent transition-colors">
          <span className="absolute left-3 text-accent text-sm opacity-70">
            ~
          </span>

          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="anthropic/claude-3.5-sonnet"
            className="w-full bg-transparent border-none outline-none py-2 pl-8 pr-28 text-sm text-text-1 placeholder:text-text-3"
          />

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="absolute right-2 text-[10px] tracking-widest text-text-3 hover:text-accent transition-colors border border-border-main px-2 py-0.5 bg-bg-surface"
          >
            {isOpen ? 'CLOSE' : 'SELECT'}
          </button>
        </div>

        {selectedModel && (
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] tracking-wider">
            <span className="border border-accent/25 bg-accent/5 text-accent px-2 py-1">
              {selectedModel.name ?? selectedModel.id}
            </span>

            {selectedContext && (
              <span className="border border-border-main bg-bg-base text-text-3 px-2 py-1">
                {selectedContext}
              </span>
            )}

            {selectedPricing?.input && (
              <span className="border border-border-main bg-bg-base text-sky-400 px-2 py-1">
                IN {selectedPricing.input}
              </span>
            )}

            {selectedPricing?.output && (
              <span className="border border-border-main bg-bg-base text-violet-400 px-2 py-1">
                OUT {selectedPricing.output}
              </span>
            )}

            {selectedModel.supported_parameters?.includes('tools') && (
              <span className="border border-emerald-400/25 bg-emerald-400/5 text-emerald-400 px-2 py-1">
                TOOLS
              </span>
            )}
          </div>
        )}

        {isOpen && (
          <div className="absolute z-50 mt-2 w-full border border-accent/40 bg-bg-surface shadow-[0_0_20px_rgba(var(--color-accent),0.12)]">
            <div className="p-3 border-b border-border-main bg-bg-base/60">
              <div className="flex items-center gap-2">
                <span className="text-accent text-xs">?</span>

                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search models, providers, capabilities..."
                  className="w-full bg-transparent border-none outline-none text-xs text-text-1 placeholder:text-text-3"
                  autoFocus
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-4 text-[10px] text-text-3 tracking-wider">
                <span className="truncate">
                  SOURCE: {modelsUrl || 'INVALID_BASE_URL'}
                </span>

                <span className="shrink-0">
                  {fetchState.status === 'ready'
                    ? `${models.length} MODELS`
                    : fetchState.status.toUpperCase()}
                </span>
              </div>

              {fetchState.status === 'error' && (
                <div className="mt-2 text-[10px] text-red-400 tracking-wider">
                  MODEL FETCH ERROR: {fetchState.error}
                </div>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {fetchState.status === 'loading' && (
                <div className="p-4 text-[11px] text-yellow-400 tracking-widest animate-pulse">
                  SCANNING MODEL REGISTRY…
                </div>
              )}

              {fetchState.status !== 'loading' && filteredModels.length === 0 && (
                <div className="p-4 text-[11px] text-text-3 tracking-widest">
                  NO MATCHES. You can still type a model ID manually.
                </div>
              )}

              {filteredModels.map((item) => {
                const pricing = getLowestPricing(item);
                const isSelected = item.id === model;
                const context = formatContextLength(item.context_length);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setModel(item.id);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-left px-3 py-3 border-b border-border-main hover:bg-accent/10 transition-colors ${isSelected ? 'bg-accent/10' : ''
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5 text-[10px] text-accent">
                        {isSelected ? '◆' : '◇'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-[12px] text-text-1 font-bold tracking-wider truncate">
                            {item.name ?? item.id}
                          </div>

                          {item.supported_parameters?.includes('tools') && (
                            <span className="shrink-0 text-[9px] text-emerald-400 border border-emerald-400/25 bg-emerald-400/5 px-1.5 py-0.5">
                              TOOLS
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-[10px] text-text-3 break-all">
                          {item.id}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-[9px] tracking-wider">
                          {context && (
                            <span className="border border-border-main bg-bg-base px-1.5 py-0.5 text-text-3">
                              {context}
                            </span>
                          )}

                          {pricing.input && (
                            <span className="border border-border-main bg-bg-base px-1.5 py-0.5 text-sky-400">
                              IN {pricing.input}
                            </span>
                          )}

                          {pricing.output && (
                            <span className="border border-border-main bg-bg-base px-1.5 py-0.5 text-violet-400">
                              OUT {pricing.output}
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <div className="mt-2 line-clamp-2 text-[10px] text-text-3 leading-relaxed">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-3 tracking-wider leading-relaxed">
        Models are loaded from{' '}
        <span className="text-text-2">{modelsUrl || 'the configured base URL'}</span>. Manual
        model IDs are still accepted.
      </p>
    </div>
  );
}

function SectionIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-border-main bg-bg-base/30 p-3">
      <div className="text-text-1 text-[12px] font-bold tracking-widest uppercase">
        {title}
      </div>
      <p className="mt-1 text-[10px] text-text-3 tracking-wider leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function TextField({
  label,
  prefix,
  value,
  type,
  placeholder,
  onChange,
}: {
  label: string;
  prefix: string;
  value: string;
  type: string;
  placeholder: string;
  onChange: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div className="space-y-2">
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
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent border-none outline-none py-2 pl-8 pr-4 text-sm text-text-1 placeholder:text-text-3"
        />
      </div>
    </div>
  );
}

function makeModelsUrl(baseUrl: string): string {
  const cleaned = baseUrl.trim().replace(/\/+$/, '');

  if (!cleaned) return '';

  if (cleaned.endsWith('/chat/completions')) {
    return `${cleaned.slice(0, -'/chat/completions'.length)}/models`;
  }

  if (cleaned.endsWith('/responses')) {
    return `${cleaned.slice(0, -'/responses'.length)}/models`;
  }

  if (cleaned.endsWith('/models')) {
    return cleaned;
  }

  return `${cleaned}/models`;
}

function normalizeModels(payload: any): ProviderModel[] {
  const rawModels = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];

  return rawModels
    .map((item: any) => {
      if (typeof item === 'string') return { id: item };

      return {
        id: String(item?.id ?? item?.model ?? ''),
        name: item?.name ?? item?.display_name,
        description: item?.description,
        context_length: item?.context_length ?? item?.contextWindow,
        pricing: item?.pricing,
        supported_parameters: item?.supported_parameters,
      } satisfies ProviderModel;
    })
    .filter((item: ProviderModel) => item.id)
    .sort((a: ProviderModel, b: ProviderModel) => a.id.localeCompare(b.id));
}

function formatContextLength(n?: number): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ctx`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K ctx`;
  return `${n} ctx`;
}

function formatPricePerMillion(value?: string): string | null {
  if (!value) return null;

  const perToken = Number(value);
  if (!Number.isFinite(perToken) || perToken <= 0) return null;

  return `$${(perToken * 1_000_000).toFixed(2)}/M`;
}

function getLowestPricing(model: ProviderModel) {
  const pricing = Array.isArray(model.pricing) ? model.pricing[0] : model.pricing;

  return {
    input: formatPricePerMillion(pricing?.prompt),
    output: formatPricePerMillion(pricing?.completion),
  };
}
