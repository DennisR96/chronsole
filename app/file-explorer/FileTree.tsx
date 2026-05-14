"use client";

import { useState } from "react";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
}

interface FileTreeProps {
  data: FileNode[];
  activeFileId: string;
  workingDirectory: string;
  onSelectFile: (path: string) => void;
}

export function FileTree({
  data,
  activeFileId,
  workingDirectory,
  onSelectFile,
}: FileTreeProps) {
  if (data.length === 0) {
    return (
      <div className="font-mono text-xs text-text-3 italic">
        Empty directory
      </div>
    );
  }

  return (
    <div className="text-sm font-mono text-text-2 flex flex-col gap-1">
      {data.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          activeFileId={activeFileId}
          workingDirectory={workingDirectory}
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
  workingDirectory: string;
  onSelectFile: (path: string) => void;
  level: number;
}

function TreeNode({
  node,
  activeFileId,
  workingDirectory,
  onSelectFile,
  level,
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(
    Boolean(node.children && node.children.length > 0)
  );
  const [isLoading, setIsLoading] = useState(false);

  const isFolder = node.type === "folder";
  const isActive = activeFileId === node.id;

  const loadChildren = async () => {
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/files?cwd=${encodeURIComponent(
          workingDirectory
        )}&path=${encodeURIComponent(node.id)}`
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setChildren(data);
      } else {
        setChildren([]);
      }

      setHasLoadedChildren(true);
    } catch (error) {
      console.error("Failed to load folder:", error);
      setChildren([]);
      setHasLoadedChildren(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!isFolder) {
      onSelectFile(node.id);
      return;
    }

    const shouldOpen = !isOpen;

    setIsOpen(shouldOpen);

    if (shouldOpen && !hasLoadedChildren) {
      await loadChildren();
    }
  };

  return (
    <div className="flex flex-col">
      <div
        onClick={handleToggle}
        style={{ paddingLeft: `${level * 12}px` }}
        className={`flex items-center gap-2 py-1 px-2 cursor-pointer rounded hover:bg-bg-hover select-none transition-colors ${isActive ? "bg-bg-hover text-text-1 font-bold" : ""
          }`}
        title={node.id}
      >
        {isFolder ? (
          <span className="w-4 h-4 flex items-center justify-center text-text-3 shrink-0">
            {isLoading ? "⟳" : isOpen ? "▼" : "▶"}
          </span>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center text-text-3 shrink-0">
            📄
          </span>
        )}

        <span className="truncate">{node.name}</span>
      </div>

      {isFolder && isOpen && (
        <div className="flex flex-col mt-1">
          {isLoading ? (
            <div
              style={{ paddingLeft: `${(level + 1) * 12 + 16}px` }}
              className="py-1 text-text-3 italic text-xs animate-pulse"
            >
              Loading...
            </div>
          ) : children.length === 0 ? (
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
                workingDirectory={workingDirectory}
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
