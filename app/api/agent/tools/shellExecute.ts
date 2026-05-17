import { exec, type ExecOptions } from 'child_process';
import { promisify } from 'util';
import { resolveToolPath } from './path';
import type { AgentTool } from './types';

const execAsync = promisify(exec);

function text(value: string | Buffer | undefined | null): string {
  return Buffer.isBuffer(value) ? value.toString('utf8') : value ?? '';
}

export const shellExecuteTool: AgentTool = {
  definition: {
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
            description:
              'The shell command to execute (bash on Unix, cmd/powershell on Windows)',
          },
          working_directory: {
            type: 'string',
            description:
              'Optional: override the working directory for this specific command',
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

  async execute(args, { workDir }) {
    const opts: ExecOptions = {
      timeout: args.timeout_ms ?? 30000,
      maxBuffer: 1024 * 1024 * 5,
      encoding: 'utf8',
      cwd: args.working_directory
        ? resolveToolPath(args.working_directory, workDir)
        : workDir ?? undefined,
    };

    try {
      const { stdout, stderr } = await execAsync(args.command, opts);

      const stdoutText = text(stdout).trim();
      const stderrText = text(stderr).trim();

      const out: Record<string, string> = {};

      if (stdoutText) out.stdout = stdoutText;
      if (stderrText) out.stderr = stderrText;
      if (!stdoutText && !stderrText) out.result = '(no output)';

      return JSON.stringify(out);
    } catch (err: any) {
      const stdoutText = text(err.stdout).trim();
      const stderrText = text(err.stderr).trim();

      return JSON.stringify({
        error: err.message,
        stdout: stdoutText,
        stderr: stderrText,
        exit_code: err.code ?? 1,
      });
    }
  },
};
