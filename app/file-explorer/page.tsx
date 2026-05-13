"use client";

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Sidebar } from '@/components/Sidebar';
import { FileTree, FileNode } from '@/components/FileTree';
import { FileViewer } from '@/components/FileViewer';

export default function FileExplorerPage() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;

  const [activeFile, setActiveFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
  const [fileSystem, setFileSystem] = useState<FileNode[]>([]);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    fetch('/api/files')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setFileSystem(data);
        } else {
          console.error('Expected an array of FileNode, but received:', data);
          setFileSystem([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load file system:', err);
        setFileSystem([]);
      });
  }, []);

  useEffect(() => {
    if (!activeFile) return;

    setIsFileLoading(true);

    fetch(`/api/files/content?path=${encodeURIComponent(activeFile)}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setFileContent(data.content || '');
      })
      .catch((err) => {
        console.error(err);
        setFileContent(`Error: Could not retrieve file content. (${err.message})`);
      })
      .finally(() => {
        setIsFileLoading(false);
      });
  }, [activeFile]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.'));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <Sidebar activeTab="files" />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex h-12 bg-bg-surface shrink-0 items-end px-4 gap-2 border-b border-border-main overflow-x-auto no-scrollbar">
          <div className="flex items-center h-full pr-6 text-sm font-bold tracking-widest text-text-1">
            CHRONOSOLE // EXPLORER
          </div>
          <div className="hidden lg:flex items-center h-full px-4 gap-6 font-mono text-[11px] text-text-2 border-l border-border-main ml-auto">
            <div className="tracking-wider">{date} // {time}</div>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 shrink-0 h-full bg-bg-surface overflow-y-auto p-4 custom-scrollbar">
            <FileTree
              data={fileSystem}
              activeFileId={activeFile}
              onSelectFile={setActiveFile}
            />
          </div>

          <FileViewer
            filePath={activeFile}
            content={fileContent}
            isLoading={isFileLoading}
          />
        </div>
      </div>
    </div>
  );
}
