import fs from 'fs/promises';
import { resolveToolPath } from './path';
import type { AgentTool } from './types';

export const fileReadTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'file_read',
      description: 'Read the contents of a file from the local filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative file path',
          },
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

  async execute(args, { workDir }) {
    const resolvedPath = resolveToolPath(args.path, workDir);
    const encoding = (args.encoding as BufferEncoding) ?? 'utf-8';

    const content = await fs.readFile(resolvedPath, encoding);

    return content.length > 20000
      ? content.slice(0, 20000) + '\n…[TRUNCATED]'
      : content;
  },
};
