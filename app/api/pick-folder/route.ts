// app/api/pick-folder/route.ts
// Opens a native OS folder-picker dialog and returns the selected path.
// Works on macOS (osascript), Windows (PowerShell), and Linux (zenity / kdialog / yad).

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Give the user up to 5 minutes to pick a folder before we time out.
const PICKER_TIMEOUT_MS = 5 * 60 * 1000;

export async function GET() {
  const platform = process.platform;

  try {
    let folderPath: string | null = null;

    // ── macOS ──────────────────────────────────────────────────────────────
    if (platform === 'darwin') {
      // FIX: previously used `set f to …` which assigns but never prints.
      // Simply evaluating the expression prints the POSIX path to stdout.
      const script = `osascript -e 'POSIX path of (choose folder with prompt "Select work directory")'`;
      const { stdout } = await execAsync(script, { timeout: PICKER_TIMEOUT_MS });
      folderPath = stdout.trim().replace(/\/$/, '') || null;

      // ── Windows ────────────────────────────────────────────────────────────
    } else if (platform === 'win32') {
      const ps =
        `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ` +
        `Add-Type -AssemblyName System.Windows.Forms; ` +
        `$d = New-Object System.Windows.Forms.FolderBrowserDialog; ` +
        `$d.Description = 'Select work directory'; ` +
        `$d.RootFolder = 'MyComputer'; ` +
        `$r = $d.ShowDialog(); ` +
        `if ($r -eq 'OK') { Write-Output $d.SelectedPath }`;
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "${ps}"`,
        { timeout: PICKER_TIMEOUT_MS }
      );
      folderPath = stdout.trim() || null;

      // ── Linux ──────────────────────────────────────────────────────────────
    } else {
      const tryLinux = async (): Promise<string | null> => {
        const tools = [
          `zenity --file-selection --directory --title="Select work directory"`,
          `yad --file --directory --title="Select work directory"`,
          `kdialog --getexistingdirectory "$HOME" "Select work directory"`,
        ];
        for (const cmd of tools) {
          try {
            const { stdout } = await execAsync(cmd, { timeout: PICKER_TIMEOUT_MS });
            const p = stdout.trim();
            if (p) return p;
          } catch (err: any) {
            // exit code 1 from zenity/kdialog means "cancelled" — propagate that
            if (err.code === 1) return null;
            // otherwise the tool isn't installed; try the next one
            continue;
          }
        }
        return undefined as any; // signals "no tool found"
      };

      const result = await tryLinux();
      if (result === undefined) {
        return NextResponse.json(
          { error: 'No dialog tool found. Install zenity, yad, or kdialog.' },
          { status: 500 }
        );
      }
      folderPath = result;
    }

    if (!folderPath) {
      // User closed the dialog without selecting anything.
      return NextResponse.json({ cancelled: true });
    }

    return NextResponse.json({ path: folderPath });

  } catch (err: any) {
    const msg: string = err.message ?? '';
    // osascript exits with code 1 when the user clicks Cancel — not an error.
    if (
      msg.includes('User canceled') ||
      msg.includes('cancelled') ||
      msg.includes('cancel') ||
      err.code === 1
    ) {
      return NextResponse.json({ cancelled: true });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
