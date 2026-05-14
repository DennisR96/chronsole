"use client";

import { useEffect, useState } from "react";
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

export default function FileExplorerPage() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;

  const [activeFile, setActiveFile] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [savedFileContent, setSavedFileContent] = useState<string>("");
  const [fileUrl, setFileUrl] = useState<string>("");
  const [isFileLoading, setIsFileLoading] = useState<boolean>(false);
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>("");
  const [fileSystem, setFileSystem] = useState<FileNode[]>([]);
  const [isTreeLoading, setIsTreeLoading] = useState<boolean>(false);

  const {
    workingDirectory,
    directoryInput,
    setWorkingDirectory,
    setDirectoryInput,
    resetWorkingDirectory,
  } = useFileExplorerStore();

  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  const isDirty = fileContent !== savedFileContent;

  const clearActiveFileState = () => {
    setActiveFile("");
    setFileContent("");
    setSavedFileContent("");
    setFileUrl("");
    setSaveError("");
    setIsSavingFile(false);
  };

  const loadFileSystem = async (cwd: string) => {
    setIsTreeLoading(true);

    try {
      const res = await fetch(`/api/files?cwd=${encodeURIComponent(cwd)}`);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        setFileSystem(data);
        clearActiveFileState();
      } else {
        console.error("Expected an array of FileNode, but received:", data);
        setFileSystem([]);
        clearActiveFileState();
      }
    } catch (err) {
      console.error("Failed to load file system:", err);
      setFileSystem([]);
      clearActiveFileState();
    } finally {
      setIsTreeLoading(false);
    }
  };

  const saveActiveFile = async () => {
    if (!activeFile || isBinaryPreviewFile(activeFile)) return;

    setIsSavingFile(true);
    setSaveError("");

    try {
      const res = await fetch("/api/files/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cwd: workingDirectory,
          path: activeFile,
          content: fileContent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      setSavedFileContent(fileContent);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save file";

      console.error(error);
      setSaveError(message);
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleSelectFile = (nextFile: string) => {
    if (nextFile === activeFile) return;

    if (isDirty) {
      const shouldDiscard = window.confirm(
        "You have unsaved changes. Discard them and open another file?"
      );

      if (!shouldDiscard) return;
    }

    setActiveFile(nextFile);
  };

  useEffect(() => {
    loadFileSystem(workingDirectory);
  }, [workingDirectory]);

  useEffect(() => {
    if (!activeFile) return;

    let objectUrl = "";

    setIsFileLoading(true);
    setFileContent("");
    setSavedFileContent("");
    setFileUrl("");
    setSaveError("");

    const encodedCwd = encodeURIComponent(workingDirectory);
    const encodedPath = encodeURIComponent(activeFile);

    if (isBinaryPreviewFile(activeFile)) {
      fetch(`/api/files/raw?cwd=${encodedCwd}&path=${encodedPath}`)
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${res.status}`);
          }

          return res.blob();
        })
        .then((blob) => {
          objectUrl = URL.createObjectURL(blob);
          setFileUrl(objectUrl);
          setFileContent("");
          setSavedFileContent("");
        })
        .catch((err) => {
          console.error(err);
          const message = `Error: Could not retrieve file. (${err.message})`;
          setFileContent(message);
          setSavedFileContent(message);
        })
        .finally(() => {
          setIsFileLoading(false);
        });

      return () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }

    fetch(`/api/files/content?cwd=${encodedCwd}&path=${encodedPath}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }

        return res.json();
      })
      .then((data) => {
        const nextContent = data.content || "";
        setFileContent(nextContent);
        setSavedFileContent(nextContent);
        setSaveError("");
      })
      .catch((err) => {
        console.error(err);

        const message = `Error: Could not retrieve file content. (${err.message})`;

        setFileContent(message);
        setSavedFileContent(message);
      })
      .finally(() => {
        setIsFileLoading(false);
      });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [activeFile, workingDirectory]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) return;

      event.preventDefault();
      saveActiveFile();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeFile, fileContent, workingDirectory]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString("en-GB", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );

      setDate(
        now
          .toLocaleDateString("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          })
          .replace(/\//g, ".")
      );
    };

    tick();

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleChangeDirectory = () => {
    if (isDirty) {
      const shouldDiscard = window.confirm(
        "You have unsaved changes. Discard them and change directory?"
      );

      if (!shouldDiscard) return;
    }

    const nextDirectory = directoryInput.trim() || ".";

    if (nextDirectory === workingDirectory) {
      loadFileSystem(nextDirectory);
      return;
    }

    setWorkingDirectory(nextDirectory);
  };

  const handleResetDirectory = () => {
    if (isDirty) {
      const shouldDiscard = window.confirm(
        "You have unsaved changes. Discard them and go back to root?"
      );

      if (!shouldDiscard) return;
    }

    resetWorkingDirectory();
  };

  const handleRefreshDirectory = () => {
    if (isDirty) {
      const shouldDiscard = window.confirm(
        "You have unsaved changes. Discard them and refresh?"
      );

      if (!shouldDiscard) return;
    }

    loadFileSystem(workingDirectory);
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
                handleChangeDirectory();
              }
            }}
            className="flex-1 min-w-0 bg-bg-surface border border-border-main rounded px-3 py-1.5 text-text-1 outline-none focus:border-accent"
            placeholder="Enter working directory..."
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
        </div>

        <div className="flex h-8 shrink-0 items-center px-4 border-b border-border-main bg-bg-surface font-mono text-[11px] text-text-3">
          <span className="truncate">
            WORKING DIRECTORY:{" "}
            <span className="text-text-1">{workingDirectory}</span>
          </span>

          {activeFile && isDirty && (
            <span className="ml-auto text-accent shrink-0">
              UNSAVED CHANGES
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="w-80 shrink-0 h-full bg-bg-surface overflow-y-auto p-4 custom-scrollbar">
            {isTreeLoading ? (
              <div className="font-mono text-xs text-text-3 animate-pulse">
                LOADING DIRECTORY //...
              </div>
            ) : (
              <FileTree
                data={fileSystem}
                activeFileId={activeFile}
                workingDirectory={workingDirectory}
                onSelectFile={handleSelectFile}
              />
            )}
          </div>

          <FileViewer
            filePath={activeFile}
            content={fileContent}
            fileUrl={fileUrl}
            isLoading={isFileLoading}
            isDirty={isDirty}
            isSaving={isSavingFile}
            saveError={saveError}
            onChangeContent={setFileContent}
            onSave={saveActiveFile}
          />
        </div>
      </div>
    </div>
  );
}
