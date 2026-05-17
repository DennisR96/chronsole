"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sidebar } from "@/components/Sidebar";
import { FileTree, FileNode } from "./FileTree";
import { FileViewer } from "./FileViewer";
import { useFileExplorerStore } from "@/store/fileExplorerStore";

function getFileExtension(filePath: string) {
  return filePath.split(".").pop()?.toLowerCase() || "";
}

function isBinaryPreviewFile(filePath: string) {
  return [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "bmp",
    "ico",
    "pdf",
  ].includes(getFileExtension(filePath));
}

function getFileName(filePath: string) {
  return filePath.split("/").pop() || filePath;
}

interface OpenFileTab {
  path: string;
  content: string;
  savedContent: string;
  fileUrl: string;
  isLoading: boolean;
  isSaving: boolean;
  saveError: string;
}

type ChronosoleWindow = Window &
  typeof globalThis & {
    chronosole?: {
      isElectron: boolean;
      platform: string;
      selectDirectory?: () => Promise<string | null>;
    };
  };

export default function FileExplorerPage() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;

  const [openTabs, setOpenTabs] = useState<OpenFileTab[]>([]);
  const [activeFile, setActiveFile] = useState<string>("");

  const [fileSystem, setFileSystem] = useState<FileNode[]>([]);
  const [isTreeLoading, setIsTreeLoading] = useState<boolean>(false);
  const [treeError, setTreeError] = useState<string>("");
  const [hasSelectedDirectory, setHasSelectedDirectory] =
    useState<boolean>(false);

  const [isFileBrowserVisible, setIsFileBrowserVisible] =
    useState<boolean>(true);
  const [vimMode, setVimMode] = useState<boolean>(false);

  const {
    workingDirectory,
    directoryInput,
    setWorkingDirectory,
    setDirectoryInput,
    resetWorkingDirectory,
  } = useFileExplorerStore();

  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  const activeTab = useMemo(() => {
    return openTabs.find((tab) => tab.path === activeFile);
  }, [openTabs, activeFile]);

  const hasDirtyTabs = useMemo(() => {
    return openTabs.some((tab) => tab.content !== tab.savedContent);
  }, [openTabs]);

  const isDirty = Boolean(
    activeTab && activeTab.content !== activeTab.savedContent,
  );

  const updateTab = (path: string, patch: Partial<OpenFileTab>) => {
    setOpenTabs((tabs) =>
      tabs.map((tab) => (tab.path === path ? { ...tab, ...patch } : tab)),
    );
  };

  const revokeAllObjectUrls = () => {
    openTabs.forEach((tab) => {
      if (tab.fileUrl) {
        URL.revokeObjectURL(tab.fileUrl);
      }
    });
  };

  const clearOpenTabs = () => {
    revokeAllObjectUrls();
    setOpenTabs([]);
    setActiveFile("");
  };

  const loadFileSystem = async (cwd: string) => {
    const nextCwd = cwd.trim();

    if (!nextCwd) {
      setFileSystem([]);
      clearOpenTabs();
      setTreeError("No working directory selected.");
      return;
    }

    setIsTreeLoading(true);
    setTreeError("");

    try {
      const url = `/api/files?cwd=${encodeURIComponent(nextCwd)}`;

      console.log("[FileExplorer] Loading directory:", nextCwd);
      console.log("[FileExplorer] Request URL:", url);

      const res = await fetch(url, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      if (!Array.isArray(data)) {
        console.error("Expected FileNode[], received:", data);
        throw new Error("Invalid directory response");
      }

      console.log("[FileExplorer] Loaded entries:", data.length, data);

      setFileSystem(data);
      clearOpenTabs();
      setHasSelectedDirectory(true);
    } catch (err) {
      console.error("[FileExplorer] Failed to load file system:", err);

      const message =
        err instanceof Error ? err.message : "Failed to load file system";

      setFileSystem([]);
      clearOpenTabs();
      setTreeError(message);
      setHasSelectedDirectory(true);
    } finally {
      setIsTreeLoading(false);
    }
  };

  const loadFolderChildren = async (node: FileNode) => {
    if (!workingDirectory) {
      throw new Error("No working directory selected.");
    }

    const url = `/api/files?cwd=${encodeURIComponent(
      workingDirectory,
    )}&path=${encodeURIComponent(node.id)}`;

    console.log("[FileExplorer] Loading folder children:", {
      folder: node.id,
      url,
    });

    const res = await fetch(url, {
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    if (!Array.isArray(data)) {
      throw new Error("Invalid directory response");
    }

    return data as FileNode[];
  };

  const saveActiveFile = async () => {
    if (!activeTab || isBinaryPreviewFile(activeTab.path)) return;

    updateTab(activeTab.path, {
      isSaving: true,
      saveError: "",
    });

    try {
      const res = await fetch("/api/files/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cwd: workingDirectory,
          path: activeTab.path,
          content: activeTab.content,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      updateTab(activeTab.path, {
        savedContent: activeTab.content,
        isSaving: false,
        saveError: "",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save file";

      console.error(error);

      updateTab(activeTab.path, {
        saveError: message,
        isSaving: false,
      });
    }
  };

  const handleSelectFile = async (nextFile: string) => {
    const existingTab = openTabs.find((tab) => tab.path === nextFile);

    if (existingTab) {
      setActiveFile(nextFile);
      return;
    }

    const newTab: OpenFileTab = {
      path: nextFile,
      content: "",
      savedContent: "",
      fileUrl: "",
      isLoading: true,
      isSaving: false,
      saveError: "",
    };

    setOpenTabs((tabs) => [...tabs, newTab]);
    setActiveFile(nextFile);

    const encodedCwd = encodeURIComponent(workingDirectory);
    const encodedPath = encodeURIComponent(nextFile);

    try {
      if (isBinaryPreviewFile(nextFile)) {
        const res = await fetch(
          `/api/files/raw?cwd=${encodedCwd}&path=${encodedPath}`,
          {
            cache: "no-store",
          },
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        updateTab(nextFile, {
          fileUrl: objectUrl,
          content: "",
          savedContent: "",
          isLoading: false,
          saveError: "",
        });

        return;
      }

      const res = await fetch(
        `/api/files/content?cwd=${encodedCwd}&path=${encodedPath}`,
        {
          cache: "no-store",
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const nextContent = data.content || "";

      updateTab(nextFile, {
        content: nextContent,
        savedContent: nextContent,
        fileUrl: "",
        isLoading: false,
        saveError: "",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load file";

      console.error(error);

      const errorContent = `Error: Could not retrieve file. (${message})`;

      updateTab(nextFile, {
        content: errorContent,
        savedContent: errorContent,
        fileUrl: "",
        saveError: message,
        isLoading: false,
      });
    }
  };

  const closeTab = (path: string) => {
    const tab = openTabs.find((item) => item.path === path);

    if (!tab) return;

    if (tab.content !== tab.savedContent) {
      const shouldClose = window.confirm(
        "You have unsaved changes. Close this tab anyway?",
      );

      if (!shouldClose) return;
    }

    if (tab.fileUrl) {
      URL.revokeObjectURL(tab.fileUrl);
    }

    setOpenTabs((tabs) => {
      const nextTabs = tabs.filter((item) => item.path !== path);

      if (activeFile === path) {
        const closedTabIndex = tabs.findIndex((item) => item.path === path);
        const fallbackTab =
          nextTabs[closedTabIndex - 1] ||
          nextTabs[closedTabIndex] ||
          nextTabs.at(-1);

        setActiveFile(fallbackTab?.path || "");
      }

      return nextTabs;
    });
  };

  const closeActiveTab = () => {
    if (!activeFile) return;
    closeTab(activeFile);
  };

  const moveToPreviousTab = () => {
    if (openTabs.length <= 1 || !activeFile) return;

    const activeIndex = openTabs.findIndex((tab) => tab.path === activeFile);
    const previousIndex =
      activeIndex <= 0 ? openTabs.length - 1 : activeIndex - 1;

    setActiveFile(openTabs[previousIndex].path);
  };

  const moveToNextTab = () => {
    if (openTabs.length <= 1 || !activeFile) return;

    const activeIndex = openTabs.findIndex((tab) => tab.path === activeFile);
    const nextIndex =
      activeIndex === -1 || activeIndex === openTabs.length - 1
        ? 0
        : activeIndex + 1;

    setActiveFile(openTabs[nextIndex].path);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hasModifier = event.metaKey || event.ctrlKey;

      if (!hasModifier) return;

      if (key === "s") {
        event.preventDefault();
        saveActiveFile();
        return;
      }

      if (key === "b") {
        event.preventDefault();
        setIsFileBrowserVisible((value) => !value);
        return;
      }

      if (key === "w") {
        event.preventDefault();
        closeActiveTab();
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        moveToPreviousTab();
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        moveToNextTab();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTab, activeFile, openTabs, workingDirectory]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDirtyTabs) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasDirtyTabs]);

  useEffect(() => {
    return () => {
      openTabs.forEach((tab) => {
        if (tab.fileUrl) {
          URL.revokeObjectURL(tab.fileUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString("en-GB", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );

      setDate(
        now
          .toLocaleDateString("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
          .replace(/\//g, "."),
      );
    };

    tick();

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const confirmDiscardDirtyTabs = (message: string) => {
    if (!hasDirtyTabs) return true;
    return window.confirm(message);
  };

  const handleChangeDirectory = async () => {
    const shouldContinue = confirmDiscardDirtyTabs(
      "You have unsaved changes. Discard them and change directory?",
    );

    if (!shouldContinue) return;

    const chronosole = (window as ChronosoleWindow).chronosole;

    if (!chronosole?.selectDirectory) {
      setTreeError(
        "Electron folder picker is not available. Check electron/preload.js and BrowserWindow preload setup.",
      );
      return;
    }

    try {
      setTreeError("");

      const selectedDirectory = await chronosole.selectDirectory();

      console.log("[FileExplorer] Selected directory:", selectedDirectory);

      if (!selectedDirectory) {
        return;
      }

      setDirectoryInput(selectedDirectory);
      setWorkingDirectory(selectedDirectory);

      await loadFileSystem(selectedDirectory);
    } catch (error) {
      console.error("[FileExplorer] Failed to select directory:", error);

      const message =
        error instanceof Error ? error.message : "Failed to select directory";

      setTreeError(message);
    }
  };

  const handleApplyDirectoryInput = async () => {
    const shouldContinue = confirmDiscardDirtyTabs(
      "You have unsaved changes. Discard them and change directory?",
    );

    if (!shouldContinue) return;

    const nextDirectory = directoryInput.trim() || ".";

    setWorkingDirectory(nextDirectory);
    await loadFileSystem(nextDirectory);
  };

  const handleResetDirectory = () => {
    const shouldContinue = confirmDiscardDirtyTabs(
      "You have unsaved changes. Discard them and go back to root?",
    );

    if (!shouldContinue) return;

    setTreeError("");
    setHasSelectedDirectory(false);
    setFileSystem([]);
    clearOpenTabs();
    resetWorkingDirectory();
  };

  const handleRefreshDirectory = async () => {
    const shouldContinue = confirmDiscardDirtyTabs(
      "You have unsaved changes. Discard them and refresh?",
    );

    if (!shouldContinue) return;

    if (!workingDirectory) {
      setTreeError("No working directory selected.");
      return;
    }

    await loadFileSystem(workingDirectory);
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <Sidebar activeTab="files" />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex h-12 bg-bg-surface shrink-0 items-end px-4 gap-2 border-b border-border-main overflow-x-auto no-scrollbar">
          <div className="flex items-center h-full pr-6 text-sm font-bold tracking-widest text-text-1">
            CHRONOSOLE // EXPLORER
          </div>

          <div className="hidden lg:flex items-center h-full px-4 gap-6 font-mono text-[11px] text-text-2 border-l border-border-main ml-auto">
            <div className="tracking-wider">
              {date} // {time}
            </div>

            <ThemeToggle />
          </div>
        </div>

        <div className="flex h-12 shrink-0 items-center gap-2 px-4 border-b border-border-main bg-bg-base font-mono text-xs">
          <span className="text-text-3 shrink-0">CWD</span>

          <input
            value={directoryInput}
            onChange={(event) => setDirectoryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleApplyDirectoryInput();
              }
            }}
            className="flex-1 min-w-0 bg-bg-surface border border-border-main rounded px-3 py-1.5 text-text-1 outline-none focus:border-accent"
            placeholder="Select or enter working directory..."
            spellCheck={false}
          />

          <button
            onClick={handleChangeDirectory}
            className="px-3 py-1.5 rounded bg-bg-hover text-text-1 hover:bg-bg-raised transition-colors shrink-0"
          >
            Change
          </button>

          <button
            onClick={handleResetDirectory}
            className="px-3 py-1.5 rounded border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-hover transition-colors shrink-0"
          >
            Root
          </button>

          <button
            onClick={handleRefreshDirectory}
            className="px-3 py-1.5 rounded border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-hover transition-colors shrink-0"
          >
            Refresh
          </button>

          <button
            onClick={() => setIsFileBrowserVisible((value) => !value)}
            className="px-3 py-1.5 rounded border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-hover transition-colors shrink-0"
            title="Ctrl/Cmd + B"
          >
            {isFileBrowserVisible ? "Hide Files" : "Show Files"}
          </button>

          <button
            onClick={() => setVimMode((value) => !value)}
            className={`px-3 py-1.5 rounded border border-border-main transition-colors shrink-0 ${vimMode
                ? "text-accent bg-bg-hover"
                : "text-text-2 hover:text-text-1 hover:bg-bg-hover"
              }`}
          >
            Vim {vimMode ? "On" : "Off"}
          </button>
        </div>

        <div className="flex h-8 shrink-0 items-center px-4 border-b border-border-main bg-bg-surface font-mono text-[11px] text-text-3">
          <span className="truncate">
            WORKING DIRECTORY:{" "}
            <span className="text-text-1">
              {workingDirectory || "No directory selected"}
            </span>
          </span>

          {treeError && (
            <span className="ml-4 text-red-400 truncate">{treeError}</span>
          )}

          {hasDirtyTabs && (
            <span className="ml-auto text-accent shrink-0">
              UNSAVED CHANGES
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {isFileBrowserVisible && (
            <div className="w-80 shrink-0 h-full bg-bg-surface overflow-y-auto p-4 custom-scrollbar border-r border-border-main">
              {isTreeLoading ? (
                <div className="font-mono text-xs text-text-3 animate-pulse">
                  LOADING DIRECTORY //...
                </div>
              ) : treeError ? (
                <div className="font-mono text-xs text-red-400 whitespace-pre-wrap">
                  {treeError}
                </div>
              ) : fileSystem.length > 0 ? (
                <FileTree
                  data={fileSystem}
                  activeFileId={activeFile}
                  onSelectFile={(node) => handleSelectFile(node.id)}
                  onLoadFolder={loadFolderChildren}
                />
              ) : hasSelectedDirectory ? (
                <div className="font-mono text-xs text-text-3 italic">
                  This folder is empty or no readable entries were returned.
                </div>
              ) : (
                <div className="font-mono text-xs text-text-3 italic">
                  Click Change to select a folder.
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="flex h-9 shrink-0 items-center border-b border-border-main bg-bg-surface overflow-x-auto no-scrollbar">
              {openTabs.length === 0 ? (
                <div className="px-4 font-mono text-xs text-text-3">
                  No open files
                </div>
              ) : (
                openTabs.map((tab) => {
                  const fileName = getFileName(tab.path);
                  const dirty = tab.content !== tab.savedContent;
                  const active = tab.path === activeFile;

                  return (
                    <button
                      key={tab.path}
                      onClick={() => setActiveFile(tab.path)}
                      className={`group flex h-full items-center gap-2 border-r border-border-main px-3 font-mono text-xs transition-colors ${active
                          ? "bg-bg-base text-text-1"
                          : "bg-bg-surface text-text-3 hover:text-text-1 hover:bg-bg-hover"
                        }`}
                      title={tab.path}
                    >
                      <span className="max-w-48 truncate">
                        {fileName}
                        {dirty ? <span className="text-accent"> *</span> : null}
                      </span>

                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          closeTab(tab.path);
                        }}
                        className="opacity-60 hover:opacity-100"
                        title="Close tab"
                      >
                        ×
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <FileViewer
              filePath={activeTab?.path || ""}
              content={activeTab?.content || ""}
              fileUrl={activeTab?.fileUrl || ""}
              isLoading={activeTab?.isLoading || false}
              isDirty={isDirty}
              isSaving={activeTab?.isSaving || false}
              saveError={activeTab?.saveError || ""}
              vimMode={vimMode}
              onChangeContent={(nextContent) => {
                if (!activeTab) return;
                updateTab(activeTab.path, { content: nextContent });
              }}
              onSave={saveActiveFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
