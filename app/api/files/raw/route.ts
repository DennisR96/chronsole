import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import os from "os";
import path from "path";

export const runtime = "nodejs";

const HOME_DIR = os.homedir();

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

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

  return path.resolve(resolvedCwd, childPath);
}

function contentDispositionInline(filename: string) {
  const normalizedFilename = filename.normalize("NFC");

  const fallbackFilename = normalizedFilename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");

  return `inline; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(
    normalizedFilename
  )}`;
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

    const buffer = await fs.readFile(resolvedFilePath);
    const extension = path.extname(resolvedFilePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const filename = path.basename(resolvedFilePath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDispositionInline(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read raw file";

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
