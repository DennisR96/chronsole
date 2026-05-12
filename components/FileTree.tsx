'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder as FolderIcon, FileCode, FileText, FileImage } from 'lucide-react';

export type FileNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
};

const getFileIcon = (name: string) => {
  if (name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith('.js')) return <FileCode size={14} />;
  if (name.endsWith('.md') || name.endsWith('.txt')) return <FileText size={14} />;
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.svg')) return <FileImage size={14} />;
  return <File size={14} />;
};

export function FileTree({ data, depth = 0, activeFileId, onSelectFile }: {
  data: FileNode[];
  depth?: number;
  activeFileId?: string;
  onSelectFile?: (id: string) => void;
}) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set(['root', 'src', 'app']));

  const toggleFolder = (id: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col font-mono text-[13px] select-none">
      {data.map((node) => {
        const isOpen = openFolders.has(node.id);
        const isSelected = activeFileId === node.id;

        if (node.type === 'folder') {
          return (
            <div key={node.id} className="flex flex-col">
              <div
                className="flex items-center gap-1.5 py-1 px-2 hover:bg-bg-raised text-text-2 hover:text-text-1 cursor-pointer transition-colors"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => toggleFolder(node.id)}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FolderIcon size={14} className={isOpen ? 'text-accent' : 'text-text-3'} fill={isOpen ? 'currentColor' : 'none'} fillOpacity={0.2} />
                <span className="truncate tracking-wide">{node.name}</span>
              </div>
              {isOpen && node.children && (
                <FileTree data={node.children} depth={depth + 1} activeFileId={activeFileId} onSelectFile={onSelectFile} />
              )}
            </div>
          );
        }

        return (
          <div
            key={node.id}
            className={`flex items-center gap-2 py-1 px-2 cursor-pointer transition-colors border-l-[3px] ${isSelected
                ? 'bg-accent/10 text-accent border-accent'
                : 'text-text-3 hover:bg-bg-raised hover:text-text-1 border-transparent'
              }`}
            style={{ paddingLeft: `${depth * 12 + 20}px` }}
            onClick={() => onSelectFile?.(node.id)}
          >
            <span className={isSelected ? 'text-accent' : 'text-text-3'}>
              {getFileIcon(node.name)}
            </span>
            <span className="truncate tracking-wide">{node.name}</span>
          </div>
        );
      })}
    </div>
  );
}
