import fs from 'fs/promises';
import { resolveToolPath } from './path';
import type { AgentTool } from './types';

export const fileDeleteTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'file_delete',
      description: 'Delete a file, not a directory, from the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to delete',
          },
        },
        required: ['path'],
      },
    },
  },

  async execute(args, { workDir }) {
    const resolvedPath = resolveToolPath(args.path, workDir);

    await fs.unlink(resolvedPath);

    return `Deleted: ${resolvedPath}`;
  },
};
