// app/api/agent/mcp.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface McpRuntimeTool {
  openAITool: {
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: any;
    };
  };
  serverName: string;
  originalToolName: string;
}

interface McpSession {
  server: McpServerConfig;
  client: Client;
  transport: StdioClientTransport;
}

const MCP_PREFIX = 'mcp__';

function sanitizeToolName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 48);
}

export function isMcpToolName(name: string): boolean {
  return name.startsWith(MCP_PREFIX);
}

export function makeMcpToolName(serverName: string, toolName: string): string {
  const server = sanitizeToolName(serverName);
  const tool = sanitizeToolName(toolName);

  // Keep under common OpenAI-compatible 64 char function name limits.
  return `${MCP_PREFIX}${server}__${tool}`.slice(0, 64);
}

function normalizeToolSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return {
      type: 'object',
      properties: {},
    };
  }

  return {
    type: 'object',
    properties: schema.properties ?? {},
    required: schema.required ?? [],
    additionalProperties: schema.additionalProperties ?? true,
  };
}

function stringifyMcpResult(result: any): string {
  if (!result) return '';

  if (Array.isArray(result.content)) {
    return result.content
      .map((item: any) => {
        if (item?.type === 'text') return item.text ?? '';
        return JSON.stringify(item, null, 2);
      })
      .join('\n');
  }

  return JSON.stringify(result, null, 2);
}

export async function createMcpSessions(
  configs: McpServerConfig[] | null | undefined
): Promise<McpSession[]> {
  const enabledConfigs = (configs ?? []).filter(
    (server) => server.enabled !== false && server.name && server.command
  );

  const sessions: McpSession[] = [];

  for (const server of enabledConfigs) {
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args ?? [],
      env: {
        ...process.env,
        ...(server.env ?? {}),
      } as Record<string, string>,
    });

    const client = new Client({
      name: 'chronosole-agent',
      version: '1.0.0',
    });

    await client.connect(transport);

    sessions.push({
      server,
      client,
      transport,
    });
  }

  return sessions;
}

export async function listMcpTools(
  sessions: McpSession[]
): Promise<{
  tools: McpRuntimeTool[];
  lookup: Record<string, { serverName: string; originalToolName: string }>;
}> {
  const tools: McpRuntimeTool[] = [];
  const lookup: Record<string, { serverName: string; originalToolName: string }> = {};

  for (const session of sessions) {
    const listed = await session.client.listTools();

    for (const tool of listed.tools ?? []) {
      const exposedName = makeMcpToolName(session.server.name, tool.name);

      lookup[exposedName] = {
        serverName: session.server.name,
        originalToolName: tool.name,
      };

      tools.push({
        serverName: session.server.name,
        originalToolName: tool.name,
        openAITool: {
          type: 'function',
          function: {
            name: exposedName,
            description: `[MCP:${session.server.name}] ${tool.description ?? tool.name}`,
            parameters: normalizeToolSchema(tool.inputSchema),
          },
        },
      });
    }
  }

  return { tools, lookup };
}

export async function executeMcpTool(
  sessions: McpSession[],
  toolName: string,
  args: Record<string, unknown>,
  lookup: Record<string, { serverName: string; originalToolName: string }>
): Promise<string> {
  const target = lookup[toolName];

  if (!target) {
    return JSON.stringify({
      error: `Unknown MCP tool: ${toolName}`,
    });
  }

  const session = sessions.find((s) => s.server.name === target.serverName);

  if (!session) {
    return JSON.stringify({
      error: `MCP server not connected: ${target.serverName}`,
    });
  }

  const result = await session.client.callTool({
    name: target.originalToolName,
    arguments: args ?? {},
  });

  return stringifyMcpResult(result);
}

export async function closeMcpSessions(sessions: McpSession[]) {
  await Promise.allSettled(
    sessions.map(async (session) => {
      await session.client.close();
    })
  );
}
