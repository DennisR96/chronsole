import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const {
    messages,
    apiKey,
    baseUrl,
    model,
  } = await req.json();

  if (!apiKey) {
    return Response.json({ error: 'API key missing' }, { status: 400 });
  }

  const resolvedBase = (baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const resolvedModel = model ?? 'anthropic/claude-3.5-sonnet';

  const summaryPrompt = `Summarize the previous conversation for future LLM context.

Preserve:
- user goals and preferences
- important decisions
- code/file/project details
- tool results that affect future work
- unresolved tasks
- constraints and warnings

Remove:
- filler
- duplicate reasoning
- irrelevant chatter

Write a compact but useful memory summary.`;

  const llmRes = await fetch(`${resolvedBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://chronosole.ui',
      'X-Title': 'Chronosole Agent Memory',
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [
        {
          role: 'system',
          content: summaryPrompt,
        },
        {
          role: 'user',
          content: JSON.stringify(messages ?? [], null, 2),
        },
      ],
      max_tokens: 1200,
    }),
  });

  if (!llmRes.ok) {
    const errBody = await llmRes.text();

    return Response.json(
      {
        error: `LLM API error ${llmRes.status}: ${errBody.slice(0, 500)}`,
      },
      {
        status: 500,
      }
    );
  }

  const data = await llmRes.json();
  const summary = data.choices?.[0]?.message?.content?.trim();

  if (!summary) {
    return Response.json(
      {
        error: 'No summary returned from LLM',
      },
      {
        status: 500,
      }
    );
  }

  return Response.json({
    summary,
    usage: data.usage ?? null,
  });
}
