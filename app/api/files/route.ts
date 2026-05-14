import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";

export const runtime = "nodejs";

type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
};

const HOME_DIR = os.homedir();

function expandHome(inputPath: string) {
  if (inputPath === "~") {
    return HOME_DIR;
  }

  if (inputPath.startsWith("~/")) {
    return path.join(HOME_DIR, inputPath.slice(2));
  }

  return inputPath;
}

function resolveTargetPath(cwd: string | null, requestedPath: string | null) {
  const basePath = expandHome(cwd?.trim() || "~");
  const childPath = requestedPath?.trim() || ".";

  const resolvedCwd = path.isAbsolute(basePath)
    ? path.resolve(basePath)
    : path.resolve(HOME_DIR, basePath);

  const resolvedTarget = path.resolve(resolvedCwd, childPath);

  return {
    resolvedCwd,
    resolvedTarget,
  };
}

function toRelativeId(cwdPath: string, itemPath: string) {
  const relative = path.relative(cwdPath, itemPath);

  return relative.split(path.sep).join("/");
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const cwd = searchParams.get("cwd");
    const requestedPath = searchParams.get("path");

    const { resolvedCwd, resolvedTarget } = resolveTargetPath(
      cwd,
      requestedPath
    );

    const stat = await fs.stat(resolvedTarget);

    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 }
      );
    }

    const entries = await fs.readdir(resolvedTarget, {
      withFileTypes: true,
    });

    const fileSystem: FileNode[] = entries
      .map((entry) => {
        const fullPath = path.join(resolvedTarget, entry.name);
        const isFolder = entry.isDirectory();

        return {
          id: toRelativeId(resolvedCwd, fullPath),
          name: entry.name,
          type: isFolder ? "folder" : "file",
          children: isFolder ? [] : undefined,
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
      });

    return NextResponse.json(fileSystem);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read directory";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
