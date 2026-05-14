import { create } from "zustand";

interface FileExplorerState {
  workingDirectory: string;
  directoryInput: string;
  setWorkingDirectory: (workingDirectory: string) => void;
  setDirectoryInput: (directoryInput: string) => void;
  resetWorkingDirectory: () => void;
}

export const useFileExplorerStore = create<FileExplorerState>((set) => ({
  workingDirectory: ".",
  directoryInput: ".",

  setWorkingDirectory: (workingDirectory) => {
    set({
      workingDirectory,
      directoryInput: workingDirectory,
    });
  },

  setDirectoryInput: (directoryInput) => {
    set({ directoryInput });
  },

  resetWorkingDirectory: () => {
    set({
      workingDirectory: ".",
      directoryInput: ".",
    });
  },
}));
