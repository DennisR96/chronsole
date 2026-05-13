"use client";

import { useState } from 'react';

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface FileTreeProps {
  data: FileNode[];
  activeFileId: string;
  onSelectFile: (path: string) => void;
}

export function FileTree({ data, activeFileId, onSelectFile }: FileTreeProps) {
  return (
    <div className="text-sm font-mono text-text-2 flex flex-col gap-1">
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          activeFileId={activeFileId}
          onSelectFile={onSelectFile}
          level={0}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: FileNode;
  activeFileId: string;
  onSelectFile: (path: string) => void;
  level: number;
}

function TreeNode({ node, activeFileId, onSelectFile, level }: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [isLoading, setIsLoading] = useState(false);

  const isFolder = node.type === 'folder';
  const isActive = activeFileId === node.id;

  const handleToggle = async () => {
    if (!isFolder) {
      onSelectFile(node.id);
      return;
    }

    // If opening the folder and we haven't loaded its children yet
    if (!isOpen && children.length === 0) {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/files?path=${encodeURIComponent(node.id)}`);
        if (!res.ok) throw new Error('Failed to load folder');
        const data = await res.json();
        setChildren(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    setIsOpen(!isOpen);
  };

  return (
    <div className="flex flex-col">
      <div
        onClick={handleToggle}
        style={{ paddingLeft: `${level * 12}px` }}
        className={`flex items-center gap-2 py-1 px-2 cursor-pointer rounded hover:bg-bg-hover select-none transition-colors ${isActive ? 'bg-bg-hover text-text-1 font-bold' : ''
          }`}
      >
        {isFolder ? (
          <span className="w-4 h-4 flex items-center justify-center text-text-3">
            {isLoading ? '⟳' : isOpen ? '▼' : '▶'}
          </span>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center text-text-3">
            📄
          </span>
        )}
        <span className="truncate">{node.name}</span>
      </div>

      {isFolder && isOpen && (
        <div className="flex flex-col mt-1">
          {children.length === 0 && !isLoading ? (
            <div
              style={{ paddingLeft: `${(level + 1) * 12 + 16}px` }}
              className="py-1 text-text-3 italic text-xs"
            >
              Empty folder
            </div>
          ) : (
            children.map((childNode) => (
              <TreeNode
                key={childNode.id}
                node={childNode}
                activeFileId={activeFileId}
                onSelectFile={onSelectFile}
                level={level + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
