import { useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import { getRuntimeThemePatch, getTerminalTheme, TERMINAL_FONT_FAMILY } from "./terminalTheme";
import type { Tab, TerminalResource } from "./types";

interface UseTerminalResourcesArgs {
  activeId: string;
  currentTheme?: string;
  tabs: Tab[];
  mountRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  resources: MutableRefObject<Map<string, TerminalResource>>;
  initialized: MutableRefObject<Set<string>>;
  updateTabStatus: (tabId: string, status: Tab["status"]) => void;
}

export function useTerminalResources({
  activeId,
  currentTheme,
  tabs,
  mountRefs,
  resources,
  initialized,
  updateTabStatus,
}: UseTerminalResourcesArgs) {
  const bootTerminal = useCallback(
    (tabId: string, el: HTMLDivElement) => {
      if (initialized.current.has(tabId)) return;

      initialized.current.add(tabId);

      const isDark = currentTheme === "dark";

      Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("xterm-addon-image"),
      ]).then(([{ Terminal }, { FitAddon }, { ImageAddon }]) => {
        if (!mountRefs.current.has(tabId)) return;
        if (resources.current.has(tabId)) return;

        const term = new Terminal({
          cursorBlink: false,
          cursorStyle: "block",
          theme: getTerminalTheme(isDark),
          fontFamily: TERMINAL_FONT_FAMILY,
          fontSize: 14,
          fontWeight: "500",
          lineHeight: 1.5,
          letterSpacing: 0,
          scrollback: 10000,
        });

        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          if (event.metaKey && !event.ctrlKey && !event.altKey) {
            const key = event.key.toLowerCase();

            if (key === "t" || key === "w" || (event.key >= "1" && event.key <= "9")) {
              return false;
            }
          }

          return true;
        });

        const fitAddon = new FitAddon();

        term.loadAddon(fitAddon);
        term.loadAddon(new ImageAddon());
        term.open(el);
        fitAddon.fit();

        const sendSize = (socket: WebSocket) => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(
                JSON.stringify({
                  type: "resize",
                  cols: term.cols,
                  rows: term.rows,
                })
              );
            } catch {
              // Ignore socket send race during disconnects.
            }
          }
        };

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const socket = new WebSocket(
          `${protocol}//${window.location.host}/ws?sessionId=${encodeURIComponent(tabId)}`
        );

        socket.onopen = () => {
          updateTabStatus(tabId, "connected");

          requestAnimationFrame(() => {
            try {
              fitAddon.fit();
            } catch {
              // Ignore fit failures on hidden/detached terminals.
            }

            sendSize(socket);
          });

          term.write(
            `\r\n\x1b[1m\x1b[38;5;${isDark ? "190" : "202"}m[SYS_READY]\x1b[0m CONNECTION ESTABLISHED \r\n`
          );

          term.write("\x1b[90m----------------------------------------\x1b[0m\r\n\r\n");
        };

        socket.onmessage = async (event) => {
          const data = typeof event.data === "string" ? event.data : await event.data.text();

          try {
            const msg = JSON.parse(data);

            if (msg.type === "session") return;
          } catch {
            // Normal terminal output.
          }

          term.write(data);
        };

        socket.onclose = () => {
          updateTabStatus(tabId, "disconnected");
          term.write("\r\n\x1b[1m\x1b[31m[SYS_HALT]\x1b[0m CONNECTION CLOSED\r\n");
        };

        socket.onerror = () => {
          updateTabStatus(tabId, "disconnected");
        };

        term.onData((data: string) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(data);
          }
        });

        term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({ type: "resize", cols, rows }));
            } catch {
              // Ignore socket send race during disconnects.
            }
          }
        });

        const resizeObserver = new ResizeObserver(() => {
          try {
            fitAddon.fit();
          } catch {
            // Ignore fit failures on hidden/detached terminals.
          }
        });

        resizeObserver.observe(el);

        if (document.fonts?.ready) {
          document.fonts.ready.then(() => {
            try {
              fitAddon.fit();
              term.refresh(0, term.rows - 1);
            } catch {
              // Ignore refresh failures during teardown.
            }

            sendSize(socket);
          });
        }

        resources.current.set(tabId, {
          socket,
          term,
          dispose: (killSession = false) => {
            resizeObserver.disconnect();

            if (killSession && socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(JSON.stringify({ type: "close-session" }));
              } catch {
                // Ignore socket close race.
              }
            }

            try {
              term.dispose();
            } catch {
              // Ignore repeated disposal.
            }

            try {
              socket.close();
            } catch {
              // Ignore repeated close.
            }
          },
          fit: () => {
            try {
              fitAddon.fit();
            } catch {
              // Ignore fit failures on hidden/detached terminals.
            }
          },
          focus: () => {
            try {
              term.focus();
            } catch {
              // Ignore focus failures during teardown.
            }
          },
        });
      });
    },
    [currentTheme, initialized, mountRefs, resources, updateTabStatus]
  );

  const setMountRef = useCallback(
    (tabId: string) => (el: HTMLDivElement | null) => {
      if (el) {
        mountRefs.current.set(tabId, el);
        bootTerminal(tabId, el);
      } else {
        mountRefs.current.delete(tabId);
      }
    },
    [bootTerminal, mountRefs]
  );

  useEffect(() => {
    const isDark = currentTheme === "dark";
    const themePatch = getRuntimeThemePatch(isDark);

    tabs.forEach((tab) => {
      const resource = resources.current.get(tab.id);

      if (resource?.term) {
        resource.term.options.theme = {
          ...resource.term.options.theme,
          ...themePatch,
        };
      }
    });
  }, [currentTheme, resources, tabs]);

  useEffect(() => {
    const resource = resources.current.get(activeId);

    if (resource) {
      requestAnimationFrame(() => {
        resource.fit();
        resource.focus();
      });
    }
  }, [activeId, resources]);

  useEffect(() => {
    return () => {
      for (const resource of resources.current.values()) {
        resource.dispose(false);
      }

      resources.current.clear();
      initialized.current.clear();
      mountRefs.current.clear();
    };
  }, [initialized, mountRefs, resources]);

  return { setMountRef };
}
