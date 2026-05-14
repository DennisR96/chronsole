export type MessageRole =
  | 'user'
  | 'agent'
  | 'system'
  | 'tool_call'
  | 'tool_result'
  | 'tool_confirm'
  | 'memory';

export interface PendingToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type MemoryMode = 'off' | 'summary' | 'last_user_messages';

export interface MemorySettings {
  mode: MemoryMode;
  lastUserMessages: number;
  summarizeOlderThanLastUserMessages: number;
}

export interface Message {
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
  memoryMode?: MemoryMode;
}

export interface UsageState {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  llmCalls: number;
}

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export type AgentPhase = 'idle' | 'thinking' | 'tool' | 'responding' | 'awaiting_confirm';
