import { create } from "zustand";

interface BrowserActivityState {
  isBrowserRunning: boolean;
  isBrowserLoading: boolean;
  setBrowserRunning: (isBrowserRunning: boolean) => void;
  setBrowserLoading: (isBrowserLoading: boolean) => void;
  resetBrowserActivity: () => void;
}

export const useBrowserActivityStore = create<BrowserActivityState>((set) => ({
  isBrowserRunning: false,
  isBrowserLoading: false,

  setBrowserRunning: (isBrowserRunning) => set({ isBrowserRunning }),

  setBrowserLoading: (isBrowserLoading) => set({ isBrowserLoading }),

  resetBrowserActivity: () =>
    set({
      isBrowserRunning: false,
      isBrowserLoading: false,
    }),
}));
