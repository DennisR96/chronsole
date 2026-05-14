import fs from 'fs/promises';
import path from 'path';
import { resolveToolPath } from './path';
import type { AgentTool } from './types';

export const fileWriteTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'file_write',
      description: 'Write or overwrite a file on the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative file path',
          },
          content: {
            type: 'string',
            description: 'Content to write',
          },
          append: {
            type: 'boolean',
            description: 'If true, append instead of overwrite (default: false)',
          },
        },
        required: ['path', 'content'],
      },
    },
  },

  async execute(args, { workDir }) {
    const resolvedPath = resolveToolPath(args.path, workDir);
    const dir = path.dirname(resolvedPath);

    await fs.mkdir(dir, { recursive: true });

    if (args.append) {
      await fs.appendFile(resolvedPath, args.content, 'utf-8');
      return `Appended to ${resolvedPath} (${args.content.length} bytes)`;
    }

    await fs.writeFile(resolvedPath, args.content, 'utf-8');
    return `Written to ${resolvedPath} (${args.content.length} bytes)`;
  },
};
