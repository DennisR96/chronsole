// app/file-explorer/actions.ts
'use server';

import fs from 'fs';
import path from 'path';

export interface LocalFile {
  name: string;
  isDirectory: boolean;
  path: string;
}

export async function readLocalDirectory(targetPath: string): Promise<LocalFile[]> {
  try {
    // Resolve home directory if '~' is used
    const resolvedPath = targetPath.startsWith('~')
      ? path.join(process.env.HOME || '', targetPath.slice(1))
      : path.resolve(targetPath);

    const entries = await fs.promises.readdir(resolvedPath, { withFileTypes: true });

    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(resolvedPath, entry.name),
    }));
  } catch (error) {
    throw new Error(`Failed to read directory: ${(error as Error).message}`);
  }
}
