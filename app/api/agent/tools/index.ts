import { shellExecuteTool } from './shellExecute';
import { fileReadTool } from './fileRead';
import { fileWriteTool } from './fileWrite';
import { directoryListTool } from './directoryList';
import { fileDeleteTool } from './fileDelete';
import type { AgentTool, ToolExecutionContext } from './types';

const toolRegistry: AgentTool[] = [
  shellExecuteTool,
  fileReadTool,
  fileWriteTool,
  directoryListTool,
  fileDeleteTool,
];

export const TOOLS = toolRegistry.map((tool) => tool.definition);

export async function executeTool(
  name: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<string> {
  const tool = toolRegistry.find((tool) => tool.definition.function.name === name);

  if (!tool) {
    return `Unknown tool: ${name}`;
  }

  try {
    return await tool.execute(args, context);
  } catch (err: any) {
    return JSON.stringify({
      error: err.message,
    });
  }
}
