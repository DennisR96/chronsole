import type { Dispatch, SetStateAction } from 'react';
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
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-mono">
      <div className="bg-bg-surface border border-accent/50 w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-6 shadow-[0_0_20px_rgba(var(--color-accent),0.15)]">
        <div className="flex items-center justify-between border-b border-border-main pb-4 mb-6">
          <h2 className="text-accent font-bold tracking-widest uppercase">System Configuration</h2>
          <button onClick={onClose} className="text-text-3 hover:text-accent transition-colors">
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
                  The model receives only the latest N user turns and the assistant/tool messages after that point.
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
                  Older context is replaced by an LLM-generated memory summary. Recent turns remain intact.
                </p>
              </div>
            )}
          </div>

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
              Shell commands run from this directory by default. Relative paths are resolved against it. Leave empty to use the server process cwd.
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
              JSON array of stdio MCP servers. Each server can define name, command, args, env, and enabled. MCP tools are exposed as mcp__server__tool and still require approval.
            </p>
          </div>
        </div>

        <div className="mt-6 p-3 border border-yellow-400/20 bg-yellow-400/5 text-yellow-400/70 text-[11px] tracking-wider">
          ⚠ This agent can execute shell commands and call configured MCP tools. Only connect to trusted models, APIs, and MCP servers.
        </div>

        <div className="mt-4 flex gap-3">
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
  );
}
