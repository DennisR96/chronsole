"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useBrowserActivityStore } from "@/store/browserActivityStore";

type BrowserTab = {
  id: string;
  input: string;
  url: string;
  title: string;
  isLoading: boolean;
  error: string | null;
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "about:blank";
  }

  if (trimmed === "about:blank") {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

function getTabTitle(value: string) {
  if (!value || value === "about:blank") {
    return "New Tab";
  }

  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, "") || "New Tab";
  } catch {
    return "New Tab";
  }
}

function createTab(url = "about:blank"): BrowserTab {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    input: url === "about:blank" ? "" : url,
    url,
    title: getTabTitle(url),
    isLoading: false,
    error: null,
  };
}

export default function BrowserHost() {
  const initialTabRef = useRef<BrowserTab | null>(null);

  if (!initialTabRef.current) {
    initialTabRef.current = createTab();
  }

  const [tabs, setTabs] = useState<BrowserTab[]>(() => [
    initialTabRef.current as BrowserTab,
  ]);

  const [activeTabId, setActiveTabId] = useState(
    () => initialTabRef.current?.id ?? "",
  );

  const webviewRefs = useRef<Record<string, HTMLElement | null>>({});

  const setBrowserRunning = useBrowserActivityStore(
    (state) => state.setBrowserRunning,
  );
  const setBrowserLoading = useBrowserActivityStore(
    (state) => state.setBrowserLoading,
  );
  const resetBrowserActivity = useBrowserActivityStore(
    (state) => state.resetBrowserActivity,
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const isAnyTabLoading = tabs.some((tab) => tab.isLoading);

  const isBrowserRunning = tabs.some(
    (tab) => tab.url && tab.url !== "about:blank",
  );

  useEffect(() => {
    setBrowserRunning(isBrowserRunning);
  }, [isBrowserRunning, setBrowserRunning]);

  useEffect(() => {
    setBrowserLoading(isAnyTabLoading);
  }, [isAnyTabLoading, setBrowserLoading]);

  useEffect(() => {
    return () => {
      resetBrowserActivity();
    };
  }, [resetBrowserActivity]);

  const updateTab = useCallback(
    (tabId: string, updates: Partial<BrowserTab>) => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === tabId ? { ...tab, ...updates } : tab,
        ),
      );
    },
    [],
  );

  const navigateToUrl = useCallback(
    (tabId: string, rawValue: string) => {
      const nextUrl = normalizeUrl(rawValue);

      updateTab(tabId, {
        url: nextUrl,
        input: nextUrl === "about:blank" ? "" : nextUrl,
        title: getTabTitle(nextUrl),
        isLoading: nextUrl !== "about:blank",
        error: null,
      });
    },
    [updateTab],
  );

  const navigate = () => {
    if (!activeTab) return;
    navigateToUrl(activeTab.id, activeTab.input);
  };

  const goBack = () => {
    if (!activeTab) return;

    const webview = webviewRefs.current[activeTab.id] as any;

    if (webview?.canGoBack?.()) {
      webview.goBack();
    }
  };

  const goForward = () => {
    if (!activeTab) return;

    const webview = webviewRefs.current[activeTab.id] as any;

    if (webview?.canGoForward?.()) {
      webview.goForward();
    }
  };

  const reload = () => {
    if (!activeTab) return;

    const webview = webviewRefs.current[activeTab.id] as any;

    updateTab(activeTab.id, {
      isLoading: true,
      error: null,
    });

    if (webview?.reload) {
      webview.reload();
    } else {
      navigateToUrl(activeTab.id, activeTab.url);
    }
  };

  const stopLoading = () => {
    if (!activeTab) return;

    const webview = webviewRefs.current[activeTab.id] as any;

    webview?.stop?.();

    updateTab(activeTab.id, {
      isLoading: false,
    });
  };

  const openExternal = () => {
    if (!activeTab || activeTab.url === "about:blank") return;

    window.open(activeTab.url, "_blank", "noopener,noreferrer");
  };

  const addTab = (url = "about:blank") => {
    const newTab = createTab(url);

    setTabs((currentTabs) => [...currentTabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    setTabs((currentTabs) => {
      if (currentTabs.length === 1) {
        const replacementTab = createTab();

        webviewRefs.current = {};
        setActiveTabId(replacementTab.id);

        return [replacementTab];
      }

      const closingIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      const nextTabs = currentTabs.filter((tab) => tab.id !== tabId);

      delete webviewRefs.current[tabId];

      if (tabId === activeTabId) {
        const fallbackTab =
          nextTabs[Math.max(0, closingIndex - 1)] ?? nextTabs[0];

        setActiveTabId(fallbackTab.id);
      }

      return nextTabs;
    });
  };

  const setWebviewRef = useCallback(
    (tabId: string) => (element: HTMLElement | null) => {
      const previousElement = webviewRefs.current[tabId] as any;

      if (previousElement?._chronosoleCleanup) {
        previousElement._chronosoleCleanup();
      }

      webviewRefs.current[tabId] = element;

      if (!element) return;

      const webview = element as any;

      const handleNavigation = (event: any) => {
        const nextUrl = event?.url;

        if (!nextUrl) return;

        updateTab(tabId, {
          url: nextUrl,
          input: nextUrl === "about:blank" ? "" : nextUrl,
          title: getTabTitle(nextUrl),
          error: null,
        });
      };

      const handleTitle = (event: any) => {
        const title = event?.title;

        if (!title) return;

        updateTab(tabId, {
          title,
        });
      };

      const handleStartLoading = () => {
        updateTab(tabId, {
          isLoading: true,
          error: null,
        });
      };

      const handleStopLoading = () => {
        updateTab(tabId, {
          isLoading: false,
        });
      };

      const handleFailLoad = (event: any) => {
        if (event?.errorCode === -3) return;

        const errorDescription =
          event?.errorDescription ||
          event?.validatedURL ||
          "The page failed to load.";

        console.error("[chronosole] Webview failed to load:", event);

        updateTab(tabId, {
          isLoading: false,
          error: errorDescription,
        });
      };

      const handleDomReady = () => {
        console.log("[chronosole] Webview DOM ready:", tabId);
      };

      const handleConsoleMessage = (event: any) => {
        console.log("[chronosole] Webview console:", event?.message);
      };

      const handleNewWindow = (event: any) => {
        const targetUrl = event?.url;

        if (!targetUrl) return;

        const newTab = createTab(targetUrl);

        setTabs((currentTabs) => [...currentTabs, newTab]);
        setActiveTabId(newTab.id);
      };

      webview.addEventListener?.("did-navigate", handleNavigation);
      webview.addEventListener?.("did-navigate-in-page", handleNavigation);
      webview.addEventListener?.("page-title-updated", handleTitle);
      webview.addEventListener?.("did-start-loading", handleStartLoading);
      webview.addEventListener?.("did-stop-loading", handleStopLoading);
      webview.addEventListener?.("did-fail-load", handleFailLoad);
      webview.addEventListener?.("dom-ready", handleDomReady);
      webview.addEventListener?.("console-message", handleConsoleMessage);
      webview.addEventListener?.("new-window", handleNewWindow);

      webview._chronosoleCleanup = () => {
        webview.removeEventListener?.("did-navigate", handleNavigation);
        webview.removeEventListener?.("did-navigate-in-page", handleNavigation);
        webview.removeEventListener?.("page-title-updated", handleTitle);
        webview.removeEventListener?.("did-start-loading", handleStartLoading);
        webview.removeEventListener?.("did-stop-loading", handleStopLoading);
        webview.removeEventListener?.("did-fail-load", handleFailLoad);
        webview.removeEventListener?.("dom-ready", handleDomReady);
        webview.removeEventListener?.("console-message", handleConsoleMessage);
        webview.removeEventListener?.("new-window", handleNewWindow);
      };
    },
    [updateTab],
  );

  return (
    <div className="flex h-[100dvh] min-h-0 w-full bg-background overflow-hidden relative selection:bg-accent/20 selection:text-accent">
      <Sidebar activeTab="browser" />

      <main className="flex-1 min-h-0 bg-bg-surface text-text-1 flex flex-col relative overflow-hidden font-mono">
        <div className="h-16 shrink-0 border-b border-border-main bg-bg-base/90 backdrop-blur-xl flex items-center gap-3 px-4">
          <span className="text-accent text-[11px] tracking-widest font-semibold whitespace-nowrap">
            CHROME.VIEW
          </span>

          <button
            onClick={goBack}
            className="h-9 px-3 border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-raised transition text-xs"
          >
            ←
          </button>

          <button
            onClick={goForward}
            className="h-9 px-3 border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-raised transition text-xs"
          >
            →
          </button>

          <button
            onClick={activeTab?.isLoading ? stopLoading : reload}
            className="h-9 px-3 border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-raised transition text-xs"
          >
            {activeTab?.isLoading ? "×" : "↻"}
          </button>

          <input
            value={activeTab?.input ?? ""}
            onChange={(event) => {
              if (!activeTab) return;

              updateTab(activeTab.id, {
                input: event.target.value,
              });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                navigate();
              }
            }}
            className="h-9 flex-1 bg-bg-surface border border-border-main px-3 text-sm outline-none text-text-1 focus:border-accent/50"
            placeholder="Search or enter URL"
          />

          <button
            onClick={navigate}
            className="h-9 px-4 bg-accent text-bg-surface text-xs font-bold tracking-widest hover:opacity-90 transition"
          >
            GO
          </button>

          <button
            onClick={openExternal}
            disabled={!activeTab || activeTab.url === "about:blank"}
            className="h-9 px-4 border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-raised transition text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            EXT
          </button>
        </div>

        <div className="h-11 shrink-0 border-b border-border-main bg-bg-base flex items-end gap-1 px-3 pt-2 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab?.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={[
                  "group h-9 min-w-40 max-w-56 px-3 border border-b-0 flex items-center gap-2 text-xs transition",
                  isActive
                    ? "bg-bg-surface border-border-main text-text-1"
                    : "bg-bg-raised/40 border-transparent text-text-2 hover:text-text-1 hover:bg-bg-raised",
                ].join(" ")}
              >
                <span className="truncate flex-1 text-left">
                  {tab.isLoading ? "Loading..." : tab.title}
                </span>

                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.stopPropagation();
                      closeTab(tab.id);
                    }
                  }}
                  className="opacity-60 hover:opacity-100"
                >
                  ×
                </span>
              </button>
            );
          })}

          <button
            onClick={() => addTab()}
            className="h-9 px-3 border border-border-main border-b-0 text-text-2 hover:text-text-1 hover:bg-bg-raised transition text-xs"
          >
            +
          </button>
        </div>

        <div className="flex-1 min-h-0 relative bg-white overflow-hidden">
          {tabs.map((tab) => (
            <webview
              key={tab.id}
              ref={setWebviewRef(tab.id)}
              src={tab.url}
              className={[
                "absolute inset-0 bg-white",
                tab.id === activeTab?.id
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none",
              ].join(" ")}
              style={{
                width: "100%",
                height: "100%",
              }}
              allowpopups={true}
              partition="persist:chronosole-browser"
            />
          ))}

          {activeTab?.error && (
            <div className="absolute inset-0 bg-bg-surface text-text-1 flex items-center justify-center p-8">
              <div className="max-w-xl border border-border-main bg-bg-base p-6">
                <div className="text-accent text-xs font-bold tracking-widest mb-3">
                  PAGE LOAD ERROR
                </div>

                <div className="text-sm text-text-2 mb-4 break-words">
                  {activeTab.error}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={reload}
                    className="h-9 px-4 bg-accent text-bg-surface text-xs font-bold tracking-widest hover:opacity-90 transition"
                  >
                    RETRY
                  </button>

                  <button
                    onClick={openExternal}
                    className="h-9 px-4 border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-raised transition text-xs"
                  >
                    OPEN EXTERNAL
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
