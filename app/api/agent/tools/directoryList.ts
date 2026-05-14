import fs from 'fs/promises';
import path from 'path';
import { resolveToolPath } from './path';
import type { AgentTool } from './types';

export const directoryListTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'directory_list',
      description: 'List files and directories at a given path.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path to list',
          },
          recursive: {
            type: 'boolean',
            description: 'If true, list recursively (max depth 3)',
          },
        },
        required: ['path'],
      },
    },
  },

  async execute(args, { workDir }) {
    const resolvedPath = resolveToolPath(args.path, workDir);

    const listDir = async (dirPath: string, depth: number): Promise<string[]> => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const lines: string[] = [];

      for (const entry of entries) {
        const indent = '  '.repeat(depth);
        const icon = entry.isDirectory() ? '📁' : '📄';

        lines.push(`${indent}${icon} ${entry.name}`);

        if (entry.isDirectory() && args.recursive && depth < 3) {
          const sub = await listDir(path.join(dirPath, entry.name), depth + 1).catch(
            () => []
          );

          lines.push(...sub);
        }
      }

      return lines;
    };

    const lines = await listDir(resolvedPath, 0);

    return lines.join('\n') || '(empty directory)';
  },
};
