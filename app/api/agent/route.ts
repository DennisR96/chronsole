// app/api/agent/route.ts
// Drop this into your Next.js app at: app/api/agent/route.ts

import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'shell_execute',
      description:
        'Execute a shell command on the local machine. Returns stdout and stderr. ' +
        'Use for running scripts, checking system info, listing processes, installing packages, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute (bash on Unix, cmd/powershell on Windows)',
          },
          working_directory: {
            type: 'string',
            description: 'Optional: working directory path for the command',
          },
          timeout_ms: {
            type: 'number',
            description: 'Optional: command timeout in milliseconds (default: 30000)',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_read',
      description: 'Read the contents of a file from the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf-8)',
            enum: ['utf-8', 'base64', 'hex'],
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_write',
      description: 'Write or overwrite a file on the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
          content: { type: 'string', description: 'Content to write' },
          append: {
            type: 'boolean',
            description: 'If true, append instead of overwrite (default: false)',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'directory_list',
      description: 'List files and directories at a given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list' },
          recursive: {
            type: 'boolean',
            description: 'If true, list recursively (max depth 3)',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_delete',
      description: 'Delete a file (not a directory) from the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to delete' },
        },
        required: ['path'],
      },
    },
  },
];

// ─── Tool Executor ────────────────────────────────────────────────────────────

async function executeTool(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case 'shell_execute': {
        const opts: any = {
          timeout: args.timeout_ms ?? 30000,
          maxBuffer: 1024 * 1024 * 5,
        };
        if (args.working_directory) opts.cwd = args.working_directory;

        try {
          const { stdout, stderr } = await execAsync(args.command, opts);
          const out: Record<string, string> = {};
          if (stdout.trim()) out.stdout = stdout.trim();
          if (stderr.trim()) out.stderr = stderr.trim();
          if (!stdout.trim() && !stderr.trim()) out.result = '(no output)';
          return JSON.stringify(out);
        } catch (err: any) {
          return JSON.stringify({
            error: err.message,
            stdout: err.stdout?.trim() ?? '',
            stderr: err.stderr?.trim() ?? '',
            exit_code: err.code ?? 1,
          });
        }
      }

      case 'file_read': {
        const encoding = (args.encoding as BufferEncoding) ?? 'utf-8';
        const content = await fs.readFile(args.path, encoding);
        const preview = content.length > 20000 ? content.slice(0, 20000) + '\n…[TRUNCATED]' : content;
        return preview;
      }

      case 'file_write': {
        const dir = path.dirname(args.path);
        await fs.mkdir(dir, { recursive: true });
        if (args.append) {
          await fs.appendFile(args.path, args.content, 'utf-8');
          return `Appended to ${args.path} (${args.content.length} bytes)`;
        } else {
          await fs.writeFile(args.path, args.content, 'utf-8');
          return `Written to ${args.path} (${args.content.length} bytes)`;
        }
      }

      case 'directory_list': {
        const listDir = async (dirPath: string, depth: number): Promise<string[]> => {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          const lines: string[] = [];
          for (const entry of entries) {
            const indent = '  '.repeat(depth);
            const icon = entry.isDirectory() ? '📁' : '📄';
            lines.push(`${indent}${icon} ${entry.name}`);
            if (entry.isDirectory() && args.recursive && depth < 3) {
              const sub = await listDir(path.join(dirPath, entry.name), depth + 1).catch(() => []);
              lines.push(...sub);
            }
          }
          return lines;
        };
        const lines = await listDir(args.path, 0);
        return lines.join('\n') || '(empty directory)';
      }

      case 'file_delete': {
        await fs.unlink(args.path);
        return `Deleted: ${args.path}`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────
//
// Protocol (one HTTP request = one "step"):
//
//   Step A — initial or continuation after confirmation:
//     Request:  { messages, apiKey, baseUrl, model, pendingToolResults?: PendingToolCall[] }
//     If pendingToolResults is provided:
//       • Execute each approved tool server-side
//       • Emit tool_result events
//       • Append tool-result messages to history
//     Then call the LLM once:
//       • If LLM wants tool calls → emit tools_pending (with assistantMessage for client to store)
//         → close stream  (client will show confirmation UI, then POST again)
//       • If LLM has a final answer → emit agent_message + done → close stream
//
//   Step B — rejected tool call:
//     The client synthesises a "tool refused" tool-result message itself and
//     sends it back in `messages` on the next request (no pendingToolResults needed).

export async function POST(req: NextRequest) {
  const {
    messages,
    apiKey,
    baseUrl,
    model,
    pendingToolResults,   // PendingToolCall[] | undefined
    sessionUsage: incomingUsage,
  } = await req.json();

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key missing' }), { status: 400 });
  }

  const resolvedBase = (baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const resolvedModel = model ?? 'anthropic/claude-3.5-sonnet';

  const SYSTEM_PROMPT = `You are CHRONOSOLE, an AI agent with direct access to the user's local machine. You can execute shell commands, read/write files, and inspect the filesystem.

Available tools:
- shell_execute: Run any shell command (bash/sh on Unix, cmd on Windows)
- file_read: Read file contents
- file_write: Write or append to files
- directory_list: List directory contents
- file_delete: Delete a file

Guidelines:
- Be precise and concise in your reasoning
- Always show what commands you're running and why
- Prefer non-destructive operations unless explicitly asked
- If a command might be dangerous, state that clearly before running it
- Use multiple tool calls to gather context before making changes
- Report results accurately including errors

Think step by step, use tools to accomplish the task, then give a clear summary of what was done.`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // stream closed
        }
      };

      // ── Carry over session usage from client ──────────────────────────────
      const sessionUsage = {
        promptTokens: incomingUsage?.promptTokens ?? 0,
        completionTokens: incomingUsage?.completionTokens ?? 0,
        totalTokens: incomingUsage?.totalTokens ?? 0,
        cost: incomingUsage?.cost ?? 0,
        llmCalls: incomingUsage?.llmCalls ?? 0,
      };

      // `messages` is already the full API-formatted history (role: user | assistant | tool)
      let apiMessages: any[] = messages ?? [];

      try {
        // ── Phase 1: Execute confirmed tool calls (if any) ──────────────────
        if (pendingToolResults && pendingToolResults.length > 0) {
          const toolResultMessages: any[] = [];

          for (const tc of pendingToolResults as PendingToolCall[]) {
            // Notify frontend the tool is now actually running
            send('tool_executing', { id: tc.id, name: tc.name, args: tc.args });

            const result = await executeTool(tc.name, tc.args);

            send('tool_result', { id: tc.id, name: tc.name, result });

            toolResultMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            });
          }

          apiMessages = [...apiMessages, ...toolResultMessages];
        }

        // ── Phase 2: Single LLM call ────────────────────────────────────────
        const llmRes = await fetch(`${resolvedBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://chronosole.ui',
            'X-Title': 'Chronosole Agent',
          },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...apiMessages],
            tools: TOOLS,
            tool_choice: 'auto',
            max_tokens: 4096,
          }),
        });

        if (!llmRes.ok) {
          const errBody = await llmRes.text();
          send('error', { message: `LLM API error ${llmRes.status}: ${errBody.slice(0, 300)}` });
          controller.close();
          return;
        }

        const llmData = await llmRes.json();
        const choice = llmData.choices?.[0];
        if (!choice) {
          send('error', { message: 'No choices returned from LLM' });
          controller.close();
          return;
        }

        // ── Accumulate usage ────────────────────────────────────────────────
        const u = llmData.usage;
        if (u) {
          sessionUsage.promptTokens += u.prompt_tokens ?? 0;
          sessionUsage.completionTokens += u.completion_tokens ?? 0;
          sessionUsage.totalTokens += u.total_tokens ?? 0;
          sessionUsage.cost += u.cost ?? 0;
          sessionUsage.llmCalls += 1;
          send('usage_update', { ...sessionUsage });
        }

        const assistantMessage = choice.message;

        // ── Has tool calls → ask client for confirmation ────────────────────
        if (
          (choice.finish_reason === 'tool_calls' || assistantMessage.tool_calls?.length) &&
          assistantMessage.tool_calls
        ) {
          const toolCalls: PendingToolCall[] = assistantMessage.tool_calls.map((tc: any) => {
            let args: any = {};
            try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
            return { id: tc.id, name: tc.function.name, args };
          });

          // Send the pending event. The client must:
          //   1. Show the confirmation UI
          //   2. Append assistantMessage to its own apiMessages
          //   3. POST again with pendingToolResults = approved tool calls
          //      (or a synthetic tool-result message for rejected ones)
          send('tools_pending', {
            assistantMessage,   // client needs this to keep history accurate
            toolCalls,
            sessionUsage,
          });

          controller.close();
          return;
        }

        // ── Final answer ────────────────────────────────────────────────────
        const content =
          assistantMessage.content ??
          (assistantMessage.reasoning ? '[reasoning only, no content]' : '(no response)');

        send('agent_message', { content });
        send('done', { sessionUsage });
        controller.close();

      } catch (err: any) {
        send('error', { message: err.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
