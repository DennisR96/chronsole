import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedPath = searchParams.get('path');

    const targetPath = requestedPath || '/';
    const entries = await fs.readdir(targetPath, { withFileTypes: true });

    const fileSystem = entries.map((entry) => {
      const isFolder = entry.isDirectory();

      return {
        id: path.join(targetPath, entry.name),
        name: entry.name,
        type: isFolder ? 'folder' : 'file',
        children: isFolder ? [] : undefined,
      };
    });

    return NextResponse.json(fileSystem);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read directory' },
      { status: 500 }
    );
  }
}
