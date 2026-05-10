// app/file-explorer/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { readLocalDirectory, LocalFile } from './actions';

export default function NodeFileExplorer() {
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (pathStr: string) => {
    try {
      setError(null);
      const data = await readLocalDirectory(pathStr);
      setFiles(data);
      setCurrentPath(pathStr);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Load initial directory on mount
  useEffect(() => {
    loadDirectory('.');
  }, []);

  const handleFolderClick = (folderPath: string) => {
    loadDirectory(folderPath);
  };

  const handleGoUp = () => {
    // Basic parent directory navigation
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadDirectory(parentPath);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 font-mono text-zinc-800 dark:text-zinc-100">
        Local Backend Explorer
      </h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={handleGoUp}
          className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded hover:bg-zinc-300 text-sm font-bold"
        >
          ⬆ Up
        </button>
        <input
          type="text"
          value={currentPath}
          onChange={(e) => setCurrentPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadDirectory(currentPath)}
          className="flex-1 px-3 py-1 border rounded font-mono text-sm dark:bg-zinc-900"
        />
        <button
          onClick={() => loadDirectory(currentPath)}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
        >
          Go
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-zinc-500">
          Path: {currentPath}
        </div>
        <ul className="divide-y max-h-[400px] overflow-y-auto">
          {files.map((file) => (
            <li key={file.path}>
              {file.isDirectory ? (
                <button
                  onClick={() => handleFolderClick(file.path)}
                  className="w-full text-left flex items-center gap-2 p-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition text-sm text-blue-600 dark:text-blue-400 font-medium"
                >
                  📁 {file.name}/
                </button>
              ) : (
                <div className="flex items-center gap-2 p-2 text-sm text-zinc-700 dark:text-zinc-300">
                  📄 {file.name}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
