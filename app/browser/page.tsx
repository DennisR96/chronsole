"use client";

import { useMemo, useRef, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

function normalizeUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "https://example.com";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export default function BrowserPage() {
  const [input, setInput] = useState("https://example.com");
  const [url, setUrl] = useState("https://example.com");
  const webviewRef = useRef<HTMLElement | null>(null);

  const isElectron = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.chronosole?.isElectron);
  }, []);

  const navigate = () => {
    setUrl(normalizeUrl(input));
  };

  const goBack = () => {
    const webview = webviewRef.current as any;
    if (webview?.canGoBack?.()) {
      webview.goBack();
    }
  };

  const goForward = () => {
    const webview = webviewRef.current as any;
    if (webview?.canGoForward?.()) {
      webview.goForward();
    }
  };

  const reload = () => {
    const webview = webviewRef.current as any;
    webview?.reload?.();
  };

  const openExternal = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative selection:bg-accent/20 selection:text-accent">
      <Sidebar activeTab="browser" />

      <main className="flex-1 bg-bg-surface text-text-1 flex flex-col relative overflow-hidden font-mono">
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
            onClick={reload}
            className="h-9 px-3 border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-raised transition text-xs"
          >
            ↻
          </button>

          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
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
            className="h-9 px-4 border border-border-main text-text-2 hover:text-text-1 hover:bg-bg-raised transition text-xs"
          >
            EXT
          </button>
        </div>

        {!isElectron ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-xl border border-border-main bg-bg-base/70 p-8 shadow-[0_0_40px_rgba(124,58,237,0.12)]">
              <div className="text-accent text-xs tracking-widest mb-4">
                ELECTRON_REQUIRED
              </div>

              <h1 className="font-chakra text-3xl font-bold mb-4">
                Browser view is available in Electron mode.
              </h1>

              <p className="text-text-2 text-sm leading-relaxed mb-6">
                Run the desktop app with npm run electron. In regular browser
                mode, use the external launch button instead.
              </p>

              <button
                onClick={openExternal}
                className="px-6 py-3 bg-accent text-bg-surface font-bold tracking-widest"
              >
                [ OPEN_EXTERNAL ]
              </button>
            </div>
          </div>
        ) : (
          <webview
            ref={webviewRef}
            src={url}
            className="flex-1 w-full bg-white"
            allowpopups="true"
            partition="persist:chronosole-browser"
          />
        )}
      </main>
    </div>
  );
}
