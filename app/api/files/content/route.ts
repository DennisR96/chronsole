import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Path is required' }, { status: 400 });
  }

  try {
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      return NextResponse.json(
        { error: 'Path is a directory, not a file' },
        { status: 400 }
      );
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to read file content' },
      { status: 500 }
    );
  }
}
