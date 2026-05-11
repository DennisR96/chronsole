'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from 'next-themes';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabStatus = 'connecting' | 'connected' | 'disconnected';

interface Tab {
  id: string;
  label: string;
  status: TabStatus;
}

interface TabResources {
  socket: WebSocket | null;
  dispose: () => void;
  fit: () => void;
  focus: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tabCounter = 0;
const newTabId = () => `tab-${++tabCounter}`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function TerminalPage() {
    const { theme, resolvedTheme } = useTheme();
    const currentTheme = resolvedTheme || theme;

    const [tabs, setTabs] = useState<Tab[]>(() => [{ id: newTabId(), label: 'bash', status: 'connecting' }]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  const mountRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const resources = useRef<Map<string, TabResources>>(new Map());
  const initialized = useRef<Set<string>>(new Set());
  // stable ref so the keyboard handler always sees the latest tabs list
  const tabsRef = useRef<Tab[]>(tabs);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false }));
      setDate(now.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Ctrl+1…9 → switch tab, Ctrl+T → new tab ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 't') {
        e.preventDefault();
        const id = newTabId();
        setTabs((prev) => [...prev, { id, label: 'bash', status: 'connecting' }]);
        setActiveId(id);
        return;
      }

      const n = parseInt(e.key, 10);
      if (isNaN(n) || n < 1 || n > 9) return;
      const target = tabsRef.current[n - 1];
      if (target) {
        e.preventDefault();
        setActiveId(target.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Re-fit + focus when switching to a previously hidden panel ─────────────
  useEffect(() => {
    const res = resources.current.get(activeId);
    if (res) requestAnimationFrame(() => { res.fit(); res.focus(); });
  }, [activeId]);
    const bootTerminal = useCallback((tabId: string, el: HTMLDivElement) => {
      if (initialized.current.has(tabId)) return;
      initialized.current.add(tabId);

      const isDark = currentTheme === 'dark';

      Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit'), import('xterm-addon-image')]).then(
        ([{ Terminal }, { FitAddon }, { ImageAddon }]) => {
                    const term = new Terminal({
                      cursorBlink: true,
                      cursorStyle: 'bar',
                      theme: {
                        background: isDark ? '#16181d' : '#ffffff',
                        foreground: isDark ? '#e2e4e9' : '#111827',
                        cursor: '#f5a623',
                        cursorAccent: isDark ? '#16181d' : '#ffffff',
                        selectionBackground: '#f5a62330',
                        black: isDark ? '#16181d' : '#000000',
                        red: '#f87171',
                        green: '#6ee7b7',
                        yellow: '#fcd34d',
                        blue: '#93c5fd',
                        magenta: '#c4b5fd',
                        cyan: '#67e8f9',
                        white: isDark ? '#e2e4e9' : '#ffffff',
                        brightBlack: isDark ? '#3f4251' : '#666666',
                        brightRed: '#fca5a5',
                        brightGreen: '#a7f3d0',
                        brightYellow: '#fde68a',
                        brightBlue: '#bfdbfe',
                        brightMagenta: '#ddd6fe',
                        brightCyan: '#a5f3fc',
                        brightWhite: isDark ? '#f8fafc' : '#ffffff',
                      },
                      fontFamily:
                        '"JetBrainsMono Nerd Font","JetBrains Mono NF","JetBrains Mono Nerd Font Mono","FiraCode Nerd Font","Fira Code NF","Hack Nerd Font","MesloLGS NF","SauceCodePro Nerd Font","DM Mono","JetBrains Mono","Fira Code",ui-monospace,monospace',
                      fontSize: 13,
                      lineHeight: 1.4,
                      letterSpacing: 0,
                      scrollback: 5000,
                    });

        const fitAddon = new FitAddon();
        const imageAddon = new ImageAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(imageAddon);
        term.open(el);
        fitAddon.fit();

        const updateStatus = (s: TabStatus) =>
          setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, status: s } : t)));

        const sendSize = (sock: WebSocket) => {
          if (sock.readyState === WebSocket.OPEN) {
            try { sock.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); } catch { }
          }
        };

        const socket = new WebSocket(`ws://${window.location.host}/ws`);
        socket.onopen = () => {
          updateStatus('connected');
          requestAnimationFrame(() => {
            try { fitAddon.fit(); } catch { }
            sendSize(socket);
          });
          term.write('\r\n  \x1b[38;5;215m◆\x1b[0m  \x1b[1mConnected\x1b[0m — shell ready\r\n\r\n');
        };
        socket.onmessage = (e) => term.write(e.data);
        socket.onclose = () => {
          updateStatus('disconnected');
          term.write('\r\n  \x1b[38;5;203m◆\x1b[0m  Session ended\r\n');
        };

        term.onData((data) => { if (socket.readyState === WebSocket.OPEN) socket.send(data); });
        term.onResize(({ cols, rows }) => {
          if (socket.readyState === WebSocket.OPEN) {
            try { socket.send(JSON.stringify({ type: 'resize', cols, rows })); } catch { }
          }
        });

        const ro = new ResizeObserver(() => { try { fitAddon.fit(); } catch { } });
        ro.observe(el);

        if (document.fonts?.ready) {
          document.fonts.ready.then(() => {
            try { fitAddon.fit(); } catch { }
            sendSize(socket);
          });
        }

                resources.current.set(tabId, {
                  socket,
                  dispose: () => { ro.disconnect(); term.dispose(); socket.close(); },
                  fit: () => { try { fitAddon.fit(); } catch { } },
                  focus: () => { try { term.focus(); } catch { } },
                  term, // Add term to resources
                } as TabResources & { term: any });
      }
    );
  }, []);

  // ── Register DOM node → boot ───────────────────────────────────────────────
    const setMountRef = useCallback(
      (tabId: string) => (el: HTMLDivElement | null) => {
        if (el) { mountRefs.current.set(tabId, el); bootTerminal(tabId, el); }
        else { mountRefs.current.delete(tabId); }
      },
      [bootTerminal]
    );

    // Update terminal theme when currentTheme changes
    useEffect(() => {
      const isDark = currentTheme === 'dark';
      const newTheme = {
        background: isDark ? '#16181d' : '#ffffff',
        foreground: isDark ? '#e2e4e9' : '#111827',
        cursor: '#f5a623',
        cursorAccent: isDark ? '#16181d' : '#ffffff',
        selectionBackground: '#f5a62330',
        black: isDark ? '#16181d' : '#000000',
        red: '#f87171',
        green: '#6ee7b7',
        yellow: '#fcd34d',
        blue: '#93c5fd',
        magenta: '#c4b5fd',
        cyan: '#67e8f9',
        white: isDark ? '#e2e4e9' : '#ffffff',
        brightBlack: isDark ? '#3f4251' : '#666666',
        brightRed: '#fca5a5',
        brightGreen: '#a7f3d0',
        brightYellow: '#fde68a',
        brightBlue: '#bfdbfe',
        brightMagenta: '#ddd6fe',
        brightCyan: '#a5f3fc',
        brightWhite: isDark ? '#f8fafc' : '#ffffff',
      };

      tabs.forEach(tab => {
        const res = resources.current.get(tab.id);
        if (res && (res as any).term) {
          (res as any).term.options.theme = newTheme;
        }
      });
    }, [currentTheme, tabs]);

  // ── Re-fit + focus whenever the active tab changes (keyboard or click) ──────
  useEffect(() => {
    const res = resources.current.get(activeId);
    if (res) requestAnimationFrame(() => { res.fit(); res.focus(); });
  }, [activeId]);

  // ── Tab actions ────────────────────────────────────────────────────────────
  const addTab = () => {
    const id = newTabId();
    setTabs((prev) => [...prev, { id, label: 'bash', status: 'connecting' }]);
    setActiveId(id);
  };

  const closeTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    resources.current.get(tabId)?.dispose();
    resources.current.delete(tabId);
    initialized.current.delete(tabId);
    mountRefs.current.delete(tabId);

    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (tabId === activeId && next.length > 0) {
        const idx = prev.findIndex((t) => t.id === tabId);
        setActiveId(next[Math.min(idx, next.length - 1)].id);
      }
      return next;
    });
  };

  // ── Derived status ─────────────────────────────────────────────────────────
  const activeTab = tabs.find((t) => t.id === activeId);
  const status = activeTab?.status ?? 'connecting';
  const statusConfig = {
    connected: { color: '#6ee7b7', bg: '#6ee7b714', label: 'Connected' },
    connecting: { color: '#fcd34d', bg: '#fcd34d14', label: 'Connecting…' },
    disconnected: { color: '#f87171', bg: '#f8717114', label: 'Disconnected' },
  }[status];

  return (
    <>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/mshaugh/nerdfont-webfonts/build/jetbrainsmono.css');
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                html, body { height: 100%; background: var(--bg-base); }

                :root {
                  --radius-sm:  6px;
                  --radius-xl:  14px;
                  --font-ui:    var(--font-sans), 'DM Sans', system-ui, sans-serif;
                  --font-mono:  var(--font-mono), 'DM Mono', 'JetBrains Mono', monospace;
                }

        /* Root: just enough padding so the rounded window floats */
        .root {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          width: 100%;
          background: var(--bg-base);
          font-family: var(--font-ui);
          padding: 10px;
          animation: fadeUp 0.3s ease both;
        }

        /* ─── Window ─── */
        .window {
          flex: 1;
          display: flex;
          flex-direction: column;
          border-radius: var(--radius-xl);
          border: 1px solid var(--border);
          background: var(--bg-surface);
          overflow: hidden;
          box-shadow:
            0 0 0 1px #ffffff04 inset,
            0 1px 0 #ffffff08 inset,
            0 28px 56px #00000068;
          min-height: 0;
          position: relative;
        }
        .window::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, #ffffff12 35%, #ffffff12 65%, transparent);
          pointer-events: none; z-index: 20;
        }

        /* ─── Title bar (traffic + brand + tabs + right controls) ─── */
        .titlebar {
          display: flex;
          align-items: center;
          height: 44px;
          padding: 0 12px;
          gap: 8px;
          border-bottom: 1px solid var(--border-sub);
          background: var(--bg-surface);
          flex-shrink: 0;
          position: relative;
          z-index: 10;
          /* prevent content from wrapping */
          overflow: hidden;
        }

        .traffic {
          display: flex; gap: 6px; align-items: center; flex-shrink: 0;
        }
        .tl {
          width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; position: relative;
        }
                .tl::after {
                  content: ''; position: absolute; inset: 2.5px;
                  border-radius: 50%; background: rgba(0,0,0,0.1);
                }
        .tl-r { background: #ff5f57; }
        .tl-y { background: #febc2e; }
        .tl-g { background: #28c840; }

        .v-sep { width: 1px; height: 16px; background: var(--border); flex-shrink: 0; }

        .brand {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .brand-icon {
          width: 20px; height: 20px; border-radius: 4px;
          background: linear-gradient(135deg, #2a2d38, #1e2029);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px;
          box-shadow: inset 0 1px 0 #ffffff08;
        }
        .brand-name {
          font-size: 12px; font-weight: 600;
          color: var(--text-2); letter-spacing: -0.01em;
        }

        /* ─── Tab strip — fills remaining space ─── */
        .tabs-strip {
          display: flex; align-items: center; gap: 3px;
          flex: 1; min-width: 0;
          overflow-x: auto; scrollbar-width: none;
        }
        .tabs-strip::-webkit-scrollbar { display: none; }

        .tab {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid transparent;
          font-family: var(--font-mono);
          font-size: 11px; font-weight: 500;
          color: var(--text-3);
          cursor: pointer; user-select: none;
          white-space: nowrap; flex-shrink: 0;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .tab:hover { color: var(--text-2); background: var(--bg-raised); }
        .tab.active {
          background: var(--bg-overlay);
          border-color: var(--border);
          color: var(--text-1);
        }

        /* ⌃N badge shown on hover / active */
        .tab-kbd {
          font-size: 9px; line-height: 13px;
          padding: 0 3px; border-radius: 3px;
          background: var(--bg-raised); border: 1px solid var(--border);
          color: var(--text-3); font-family: var(--font-mono);
          opacity: 0; transition: opacity 0.12s;
        }
        .tab:hover .tab-kbd,
        .tab.active .tab-kbd { opacity: 1; }

        .tab-dot {
          width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
          transition: background 0.3s;
        }
        .tab-dot.pulse { animation: pulse 1.8s ease-in-out infinite; }

        .tab-close {
          width: 12px; height: 12px; border-radius: 3px;
          display: flex; align-items: center; justify-content: center;
          font-size: 8px; color: var(--text-3); cursor: pointer;
          opacity: 0; transition: opacity 0.12s, background 0.12s;
        }
        .tab:hover .tab-close,
        .tab.active .tab-close { opacity: 1; }
        .tab-close:hover { background: var(--border); color: var(--text-1); }

        .add-tab {
          display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: var(--radius-sm);
          background: transparent; border: 1px solid var(--border);
          color: var(--text-3); font-size: 13px; cursor: pointer; flex-shrink: 0;
          transition: background 0.12s, color 0.12s;
        }
        .add-tab:hover { background: var(--bg-overlay); color: var(--text-2); }

        /* ─── Right cluster ─── */
        .titlebar-right {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }

        .status-chip {
          display: flex; align-items: center; gap: 5px;
          padding: 3px 8px; border-radius: 999px;
          font-family: var(--font-mono); font-size: 10px; font-weight: 500;
          transition: background 0.3s, color 0.3s; white-space: nowrap;
        }

        .clock-chip {
          display: flex; align-items: center; gap: 5px;
          padding: 3px 8px; border-radius: 999px;
          border: 1px solid var(--border); background: var(--bg-raised);
          font-family: var(--font-mono); font-size: 10px; color: var(--text-2);
          white-space: nowrap;
        }
        .clock-date { color: var(--text-3); }
        .clock-sep  { color: var(--border); }

        .icon-btn {
          display: flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; border-radius: var(--radius-sm);
          background: transparent; border: none;
          color: var(--text-3); font-size: 12px; cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .icon-btn:hover { background: var(--bg-overlay); color: var(--text-2); }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }

                /* ─── Terminal panels ─── */
                .terms-wrap {
                  flex: 1; min-height: 0; position: relative; background: var(--bg-surface);
                }
        .term-panel {
          position: absolute; inset: 0;
          opacity: 0; pointer-events: none; z-index: 0;
        }
                .term-panel.active { opacity: 1; pointer-events: auto; z-index: 1; }
                .term-panel .xterm { height: 100%; padding: 10px; }
                .term-panel .xterm-viewport { background: transparent !important; }

                /* Hide the scrollbar but keep functionality if needed, 
                   or just ensure it doesn't overlap the padding oddly */
                .xterm-viewport::-webkit-scrollbar { width: 0; }

        /* ─── Status bar ─── */
        .statusbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 12px; height: 24px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-sub);
          flex-shrink: 0; z-index: 10;
        }
        .sb-left {
          display: flex; align-items: center; gap: 10px;
        }
        .sb-item {
          font-family: var(--font-mono); font-size: 9.5px; color: var(--text-3);
          display: flex; align-items: center; gap: 3px;
        }
        .sb-item b { font-weight: 400; color: var(--text-2); }
        .sb-sep { width: 1px; height: 10px; background: var(--border); }

        .kbd {
          display: inline-flex; align-items: center;
          padding: 0 3px; border-radius: 3px;
          background: var(--bg-overlay); border: 1px solid var(--border);
          font-family: var(--font-mono); font-size: 8.5px; color: var(--text-3);
        }

        .ws-badge {
          display: flex; align-items: center; gap: 4px;
          padding: 2px 7px; border-radius: var(--radius-sm);
          background: var(--accent-sub); border: 1px solid #f5a62320;
        }
        .ws-badge span { font-size: 9px; color: var(--accent); font-family: var(--font-mono); }
        .ws-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="root">
        <div className="window">

          {/* ══ Unified title bar ══ */}
          <div className="titlebar">

            <div className="traffic">
              <div className="tl tl-r" />
              <div className="tl tl-y" />
              <div className="tl tl-g" />
            </div>

            <div className="v-sep" />

            <div className="brand">
              <div className="brand-icon">⌨️</div>
              <span className="brand-name">Terminal</span>
            </div>

            <div className="v-sep" />

            {/* Tab strip */}
            <div className="tabs-strip">
              {tabs.map((tab, i) => {
                const dotColor = {
                  connected: '#6ee7b7',
                  connecting: '#fcd34d',
                  disconnected: '#f87171',
                }[tab.status];
                return (
                  <div
                    key={tab.id}
                    className={`tab ${tab.id === activeId ? 'active' : ''}`}
                    onClick={() => setActiveId(tab.id)}
                    title={`${tab.label} — Ctrl+${i + 1}`}
                  >
                    <div
                      className={`tab-dot ${tab.status === 'connected' ? 'pulse' : ''}`}
                      style={{ background: dotColor }}
                    />
                    {tab.label}
                    {i < 9 && <span className="tab-kbd">^{i + 1}</span>}
                    {tabs.length > 1 && (
                      <span className="tab-close" onClick={(e) => closeTab(e, tab.id)}>✕</span>
                    )}
                  </div>
                );
              })}
              <button className="add-tab" title="New tab" onClick={addTab}>+</button>
            </div>

                        {/* Right controls */}
                        <div className="titlebar-right">
                          <ThemeToggle />
                          <div
                            className="status-chip"
                style={{ background: statusConfig.bg, color: statusConfig.color }}
              >
                <div
                  className={`tab-dot ${status === 'connected' ? 'pulse' : ''}`}
                  style={{ background: statusConfig.color, width: 6, height: 6 }}
                />
                {statusConfig.label}
              </div>

              <div className="clock-chip">
                <span className="clock-date">{date}</span>
                <span className="clock-sep">·</span>
                <span>{time}</span>
              </div>

              <button className="icon-btn" title="Split pane">⊟</button>
              <button className="icon-btn" title="Settings">⋯</button>
            </div>
          </div>

          {/* ══ Terminal panels ══ */}
          <div className="terms-wrap">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`term-panel ${tab.id === activeId ? 'active' : ''}`}
              >
                <div ref={setMountRef(tab.id)} style={{ width: '100%', height: '100%' }} />
              </div>
            ))}
          </div>

          {/* ══ Status bar ══ */}
          <div className="statusbar">
            <div className="sb-left">
              <div className="sb-item">Shell <b>bash</b></div>
              <div className="sb-sep" />
              <div className="sb-item">UTF-8</div>
              <div className="sb-sep" />
              <div className="sb-item">Host <b>localhost</b></div>
              <div className="sb-sep" />
              <div className="sb-item"><span className="kbd">^C</span>&thinsp;interrupt</div>
              <div className="sb-sep" />
              <div className="sb-item"><span className="kbd">^D</span>&thinsp;exit</div>
              <div className="sb-sep" />
              <div className="sb-item"><span className="kbd">^T</span>&thinsp;new tab</div>
              <div className="sb-sep" />
              <div className="sb-item"><span className="kbd">^1–9</span>&thinsp;switch tab</div>
            </div>

            <div className="ws-badge">
              <div className="ws-dot" />
              <span>ws://localhost/ws · {tabs.findIndex((t) => t.id === activeId) + 1}/{tabs.length}</span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

