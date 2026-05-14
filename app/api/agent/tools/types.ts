export interface PendingToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolExecutionContext {
  workDir: string | null;
}

export interface AgentTool {
  definition: {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  };

  execute: (
    args: Record<string, any>,
    context: ToolExecutionContext
  ) => Promise<string>;
}
