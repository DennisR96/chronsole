import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";

export const runtime = "nodejs";

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
  if (!requestedPath?.trim()) {
    throw new Error("Path is required");
  }

  const basePath = expandHome(cwd?.trim() || "~");
  const childPath = requestedPath.trim();

  const resolvedCwd = path.isAbsolute(basePath)
    ? path.resolve(basePath)
    : path.resolve(HOME_DIR, basePath);

  const resolvedTarget = path.resolve(resolvedCwd, childPath);

  return resolvedTarget;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const cwd = searchParams.get("cwd");
    const filePath = searchParams.get("path");

    const resolvedFilePath = resolveTargetPath(cwd, filePath);

    const stat = await fs.stat(resolvedFilePath);

    if (stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is a directory, not a file" },
        { status: 400 }
      );
    }

    const content = await fs.readFile(resolvedFilePath, "utf-8");

    return NextResponse.json({
      content,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to read file content";

    const status = message === "Path is required" ? 400 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      {
        status,
      }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const cwd = typeof body.cwd === "string" ? body.cwd : null;
    const filePath = typeof body.path === "string" ? body.path : null;
    const content = typeof body.content === "string" ? body.content : null;

    if (!filePath?.trim()) {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      );
    }

    if (content === null) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const resolvedFilePath = resolveTargetPath(cwd, filePath);

    const stat = await fs.stat(resolvedFilePath).catch(() => null);

    if (!stat) {
      return NextResponse.json(
        { error: "File does not exist" },
        { status: 404 }
      );
    }

    if (stat.isDirectory()) {
      return NextResponse.json(
        { error: "Path is a directory, not a file" },
        { status: 400 }
      );
    }

    await fs.writeFile(resolvedFilePath, content, "utf-8");

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save file";

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
