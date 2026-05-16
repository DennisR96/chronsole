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

function isInsideDirectory(parentPath: string, childPath: string) {
  const relative = path.relative(parentPath, childPath);

  return (
    relative === "" ||
    (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative))
  );
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
      requestedPath,
    );

    console.log("[api/files] cwd:", cwd);
    console.log("[api/files] requestedPath:", requestedPath);
    console.log("[api/files] resolvedCwd:", resolvedCwd);
    console.log("[api/files] resolvedTarget:", resolvedTarget);

    if (!isInsideDirectory(resolvedCwd, resolvedTarget)) {
      return NextResponse.json(
        { error: "Path is outside the working directory" },
        { status: 403 },
      );
    }

    const stat = await fs.stat(resolvedTarget);

    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is not a directory" },
        { status: 400 },
      );
    }

    const entries = await fs.readdir(resolvedTarget, {
      withFileTypes: true,
    });

    const fileSystem: FileNode[] = [];

    for (const entry of entries) {
      try {
        const fullPath = path.join(resolvedTarget, entry.name);
        const isFolder = entry.isDirectory();

        fileSystem.push({
          id: toRelativeId(resolvedCwd, fullPath),
          name: entry.name,
          type: isFolder ? "folder" : "file",
          children: isFolder ? [] : undefined,
        });
      } catch (entryError) {
        console.warn("[api/files] Skipping unreadable entry:", {
          name: entry.name,
          error:
            entryError instanceof Error ? entryError.message : entryError,
        });
      }
    }

    fileSystem.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });

    console.log("[api/files] entries returned:", fileSystem.length);

    return NextResponse.json(fileSystem);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read directory";

    console.error("[api/files] Failed:", message);

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
