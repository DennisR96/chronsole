import path from 'path';

export function resolveToolPath(inputPath: string, workDir: string | null) {
  if (workDir && !path.isAbsolute(inputPath)) {
    return path.resolve(workDir, inputPath);
  }

  return inputPath;
}
