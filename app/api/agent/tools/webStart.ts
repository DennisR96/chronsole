import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { AgentTool } from './types';

function getChromePath(): string {
  if (process.platform === 'win32') {
    const paths = [
      String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
      String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
    ];

    const found = paths.find((chromePath) => fs.existsSync(chromePath));
    return found ?? paths[0];
  }

  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  return 'google-chrome';
}

export const webStartTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'web_start',
      description: 'Starts a new Google Chrome instance with remote debugging enabled.',
      parameters: {
        type: 'object',
        properties: {
          port: {
            type: 'integer',
            description: 'The remote debugging port to use. Defaults to 9222.',
          },
        },
        required: [],
      },
    },
  },

  async execute(args) {
    try {
      const port = Number(args.port ?? 9222);
      const chromePath = getChromePath();
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome_debug_'));

      const commandArgs = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${tempDir}`,
        '--remote-allow-origins=*',
      ];

      const child = spawn(chromePath, commandArgs, {
        detached: true,
        stdio: 'ignore',
      });

      child.unref();

      return `Successfully started Chrome with remote debugging on port ${port}.`;
    } catch (err: any) {
      return `Error starting Chrome: ${err.message}`;
    }
  },
};
