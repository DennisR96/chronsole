// app/api/agent/route.ts

import { NextRequest } from 'next/server';
import { TOOLS, executeTool } from './tools';
import type { PendingToolCall } from './tools/types';

export async function POST(req: NextRequest) {
  const {
    messages,
    apiKey,
    baseUrl,
    model,
    pendingToolResults,
    sessionUsage: incomingUsage,
    workDir,
  } = await req.json();

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key missing' }), {
      status: 400,
    });
  }

  const resolvedBase = (baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const resolvedModel = model ?? 'anthropic/claude-3.5-sonnet';

  const workDirLine = workDir
    ? `\nYour current working directory is: ${workDir}\nAll relative paths are resolved against this directory.`
    : '\nNo working directory is configured; the server process cwd will be used.';

  const SYSTEM_PROMPT = `You are CHRONOSOLE, an AI agent with direct access to the user's local machine. You can execute shell commands, read/write files, and inspect the filesystem.
${workDirLine}

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

      const sessionUsage = {
        promptTokens: incomingUsage?.promptTokens ?? 0,
        completionTokens: incomingUsage?.completionTokens ?? 0,
        totalTokens: incomingUsage?.totalTokens ?? 0,
        cost: incomingUsage?.cost ?? 0,
        llmCalls: incomingUsage?.llmCalls ?? 0,
      };

      let apiMessages: any[] = messages ?? [];

      try {
        if (pendingToolResults && pendingToolResults.length > 0) {
          const toolResultMessages: any[] = [];

          for (const tc of pendingToolResults as PendingToolCall[]) {
            send('tool_executing', {
              id: tc.id,
              name: tc.name,
              args: tc.args,
            });

            const result = await executeTool(tc.name, tc.args, {
              workDir: workDir ?? null,
            });

            send('tool_result', {
              id: tc.id,
              name: tc.name,
              result,
            });

            toolResultMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            });
          }

          apiMessages = [...apiMessages, ...toolResultMessages];
        }

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

          send('error', {
            message: `LLM API error ${llmRes.status}: ${errBody.slice(0, 300)}`,
          });

          controller.close();
          return;
        }

        const llmData = await llmRes.json();
        const choice = llmData.choices?.[0];

        if (!choice) {
          send('error', {
            message: 'No choices returned from LLM',
          });

          controller.close();
          return;
        }

        const u = llmData.usage;

        if (u) {
          sessionUsage.promptTokens += u.prompt_tokens ?? 0;
          sessionUsage.completionTokens += u.completion_tokens ?? 0;
          sessionUsage.totalTokens += u.total_tokens ?? 0;
          sessionUsage.cost += u.cost ?? 0;
          sessionUsage.llmCalls += 1;

          send('usage_update', {
            ...sessionUsage,
          });
        }

        const assistantMessage = choice.message;

        if (
          (choice.finish_reason === 'tool_calls' || assistantMessage.tool_calls?.length) &&
          assistantMessage.tool_calls
        ) {
          const toolCalls: PendingToolCall[] = assistantMessage.tool_calls.map(
            (tc: any) => {
              let args: any = {};

              try {
                args = JSON.parse(tc.function.arguments);
              } catch {
                args = {};
              }

              return {
                id: tc.id,
                name: tc.function.name,
                args,
              };
            }
          );

          send('tools_pending', {
            assistantMessage,
            toolCalls,
            sessionUsage,
          });

          controller.close();
          return;
        }

        const content =
          assistantMessage.content ??
          (assistantMessage.reasoning ? '[reasoning only, no content]' : '(no response)');

        send('agent_message', { content });
        send('done', { sessionUsage });
        controller.close();
      } catch (err: any) {
        send('error', {
          message: err.message,
        });

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
