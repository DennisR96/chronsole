// app/api/files/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

/**
 * Recursively walks the directory structure.
 */
async function walk(dir: string, depth = 0): Promise<FileNode | null> {
  if (depth > 5) return null;

  const name = path.basename(dir) || dir;
  if (name === 'node_modules' || name === '.git' || name === '.next') {
    return null;
  }

  try {
    const stats = await fs.stat(dir);

    if (!stats.isDirectory()) {
      return { id: dir, name, type: 'file' };
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const children: FileNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const childNode = await walk(fullPath, depth + 1);
        if (childNode) children.push(childNode);
      } else {
        children.push({ id: fullPath, name: entry.name, type: 'file' });
      }
    }

    children.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });

    return { id: dir, name, type: 'folder', children };
  } catch (error) {
    return null;
  }
}

export async function GET() {
  const rootPath = process.cwd();
  const tree = await walk(rootPath);
  return NextResponse.json(tree ? [tree] : []);
}
