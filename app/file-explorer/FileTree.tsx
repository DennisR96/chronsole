"use client";

import { useState } from "react";
import { FileIcon, defaultStyles } from "react-file-icon";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  hasLoadedChildren?: boolean;
}

interface FileTreeProps {
  data: FileNode[];
  activeFileId: string;
  onSelectFile: (node: FileNode) => void;
  onLoadFolder: (node: FileNode) => Promise<FileNode[]>;
}

function getFileExtension(fileName: string) {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName === "dockerfile") return "dockerfile";

  const parts = fileName.split(".");

  if (parts.length <= 1) return "";

  return parts.pop()?.toLowerCase() || "";
}

function getFileIconStyles(extension: string) {
  return defaultStyles[extension as keyof typeof defaultStyles] || {};
}

export function FileTree({
  data,
  activeFileId,
  onSelectFile,
  onLoadFolder,
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
          onSelectFile={onSelectFile}
          onLoadFolder={onLoadFolder}
          level={0}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: FileNode;
  activeFileId: string;
  onSelectFile: (node: FileNode) => void;
  onLoadFolder: (node: FileNode) => Promise<FileNode[]>;
  level: number;
}

function TreeNode({
  node,
  activeFileId,
  onSelectFile,
  onLoadFolder,
  level,
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(
    Boolean(node.hasLoadedChildren),
  );
  const [isLoading, setIsLoading] = useState(false);

  const isFolder = node.type === "folder";
  const isActive = activeFileId === node.id;
  const extension = getFileExtension(node.name);

  const handleToggle = async () => {
    if (!isFolder) {
      onSelectFile(node);
      return;
    }

    const shouldOpen = !isOpen;
    setIsOpen(shouldOpen);

    if (shouldOpen && !hasLoadedChildren) {
      setIsLoading(true);

      try {
        const loadedChildren = await onLoadFolder(node);
        setChildren(loadedChildren);
        setHasLoadedChildren(true);
      } catch (error) {
        console.error("Failed to load folder:", error);
        setChildren([]);
        setHasLoadedChildren(true);
      } finally {
        setIsLoading(false);
      }
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
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            <span className="w-3.5 h-3.5 block">
              <FileIcon
                extension={extension}
                {...getFileIconStyles(extension)}
              />
            </span>
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
                onSelectFile={onSelectFile}
                onLoadFolder={onLoadFolder}
                level={level + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
