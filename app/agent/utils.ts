import type { McpServerConfig, Message } from './types';

export const emptyUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  cost: 0,
  llmCalls: 0,
};

export const ts = () =>
  new Date().toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function parseMcpServers(raw: string): McpServerConfig[] {
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

export function formatMcpToolName(name: string): string {
  if (!name.startsWith('mcp__')) return name;

  const parts = name.split('__');

  if (parts.length >= 3) {
    return `MCP:${parts[1]} / ${parts.slice(2).join('__')}`;
  }

  return name;
}

export function formatToolSummary(name: string, args: Record<string, unknown>): string {
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

export function toolIcon(name: string): string {
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

export function riskLevel(name: string, args: Record<string, unknown>): 'low' | 'medium' | 'high' {
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

export function formatCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.00001) return '<$0.00001';
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function makeBootMessages(): Message[] {
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

export function findCutoffForLastUserMessages(apiMessages: any[], userCount: number): number {
  if (userCount <= 0) return apiMessages.length;

  let seen = 0;

  for (let i = apiMessages.length - 1; i >= 0; i--) {
    if (apiMessages[i]?.role === 'user') {
      seen += 1;

      if (seen === userCount) {
        return i;
      }
    }
  }

  return 0;
}

export function keepLastUserMessages(apiMessages: any[], userCount: number): any[] {
  const cutoff = findCutoffForLastUserMessages(apiMessages, userCount);
  return apiMessages.slice(cutoff);
}

export function isMemorySummaryMessage(msg: any): boolean {
  return (
    msg?.role === 'system' &&
    typeof msg.content === 'string' &&
    msg.content.startsWith('[CONVERSATION MEMORY SUMMARY]')
  );
}

export function stripExistingMemorySummary(apiMessages: any[]): any[] {
  return apiMessages.filter((msg) => !isMemorySummaryMessage(msg));
}

export function makeMemorySummaryMessage(summary: string) {
  return {
    role: 'system',
    content: `[CONVERSATION MEMORY SUMMARY]\n${summary.trim()}`,
  };
}
