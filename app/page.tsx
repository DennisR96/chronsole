"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from 'next-themes';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Sidebar } from '@/components/Sidebar';

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

let tabCounter = 0;
const newTabId = () => `tab-${++tabCounter}`;

export default function TerminalPage() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;

  const [tabs, setTabs] = useState<Tab[]>(() => [{ id: newTabId(), label: 'TTY1', status: 'connecting' }]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  const mountRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const resources = useRef<Map<string, TabResources>>(new Map());
  const initialized = useRef<Set<string>>(new Set());
  const tabsRef = useRef<Tab[]>(tabs);

  useEffect(() => { tabsRef.current = tabs; }, [tabs]);

  // Handle system clock ticking
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.'));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Key handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        const id = newTabId();
        setTabs((prev) => [...prev, { id, label: `TTY${prev.length + 1}`, status: 'connecting' }]);
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

  const bootTerminal = useCallback((tabId: string, el: HTMLDivElement) => {
    if (initialized.current.has(tabId)) return;
    initialized.current.add(tabId);

    const isDark = currentTheme === 'dark';

    Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit'), import('xterm-addon-image')]).then(
      ([{ Terminal }, { FitAddon }, { ImageAddon }]) => {
        const term = new Terminal({
          cursorBlink: false,
          cursorStyle: 'block',
          theme: {
            background: isDark ? '#0A0A0C' : '#FFFFFF',
            foreground: isDark ? '#FFFFFF' : '#000000',
            cursor: isDark ? '#CCFF00' : '#FF3300',
            cursorAccent: isDark ? '#000000' : '#FFFFFF',
            selectionBackground: isDark ? '#CCFF0033' : '#FF330033',
            black: isDark ? '#0A0A0C' : '#000000',
            red: '#FF3300',
            green: '#CCFF00',
            yellow: '#FFD700',
            blue: '#0055FF',
            magenta: '#FF00FF',
            cyan: '#00FFFF',
            white: isDark ? '#FFFFFF' : '#F0F0EB',
            brightBlack: '#55555A',
            brightRed: '#FF6633',
            brightGreen: '#D4FF33',
            brightYellow: '#FFEA00',
            brightBlue: '#3377FF',
            brightMagenta: '#FF33FF',
            brightCyan: '#33FFFF',
            brightWhite: '#FFFFFF',
          },
          fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
          fontSize: 14,
          fontWeight: '500',
          lineHeight: 1.5,
          letterSpacing: 0,
          scrollback: 10000,
        });

        term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
          if (e.ctrlKey && !e.altKey && !e.metaKey) {
            if (e.key.toLowerCase() === 't' || (e.key >= '1' && e.key <= '9')) {
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

        const updateStatus = (s: TabStatus) =>
          setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, status: s } : t)));

        const sendSize = (sock: WebSocket) => {
          if (sock.readyState === WebSocket.OPEN) {
            try { sock.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })); } catch { }
          }
        };

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

        socket.onopen = () => {
          updateStatus('connected');
          requestAnimationFrame(() => {
            try { fitAddon.fit(); } catch { }
            sendSize(socket);
          });
          term.write(`\r\n\x1b[1m\x1b[38;5;${isDark ? '190' : '202'}m[SYS_READY]\x1b[0m CONNECTION ESTABLISHED \r\n`);
          term.write(`\x1b[90m----------------------------------------\x1b[0m\r\n\r\n`);
        };
        socket.onmessage = (e) => term.write(e.data);
        socket.onclose = () => {
          updateStatus('disconnected');
          term.write('\r\n\x1b[1m\x1b[31m[SYS_HALT]\x1b[0m SESSION TERMINATED\r\n');
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
            try {
              fitAddon.fit();
              // Forces xterm.js to invalidate its character cache and redraw the grid
              term.refresh(0, term.rows - 1);
            } catch { }
            sendSize(socket);
          });
        }



        resources.current.set(tabId, {
          socket,
          dispose: () => { ro.disconnect(); term.dispose(); socket.close(); },
          fit: () => { try { fitAddon.fit(); } catch { } },
          focus: () => { try { term.focus(); } catch { } },
          term,
        } as TabResources & { term: any });
      }
    );
  }, [currentTheme]);

  const setMountRef = useCallback(
    (tabId: string) => (el: HTMLDivElement | null) => {
      if (el) { mountRefs.current.set(tabId, el); bootTerminal(tabId, el); }
      else { mountRefs.current.delete(tabId); }
    },
    [bootTerminal]
  );

  useEffect(() => {
    const isDark = currentTheme === 'dark';
    const newTheme = {
      background: isDark ? '#0A0A0C' : '#FFFFFF',
      foreground: isDark ? '#FFFFFF' : '#000000',
      cursor: isDark ? '#CCFF00' : '#FF3300',
      cursorAccent: isDark ? '#000000' : '#FFFFFF',
      selectionBackground: isDark ? '#CCFF0033' : '#FF330033',
      black: isDark ? '#0A0A0C' : '#000000',
      red: '#FF3300',
      green: '#CCFF00',
      white: isDark ? '#FFFFFF' : '#F0F0EB',
      brightBlack: '#55555A',
    };

    tabs.forEach(tab => {
      const res = resources.current.get(tab.id);
      if (res && (res as any).term) {
        (res as any).term.options.theme = { ...(res as any).term.options.theme, ...newTheme };
      }
    });
  }, [currentTheme, tabs]);

  useEffect(() => {
    const res = resources.current.get(activeId);
    if (res) requestAnimationFrame(() => { res.fit(); res.focus(); });
  }, [activeId]);

  const addTab = () => {
    const id = newTabId();
    setTabs((prev) => [...prev, { id, label: `TTY${prev.length + 1}`, status: 'connecting' }]);
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

  const activeTab = tabs.find((t) => t.id === activeId);
  const status = activeTab?.status ?? 'connecting';

  const statusConfig = {
    connected: { label: 'ONLINE', icon: '■' },
    connecting: { label: 'LINKING', icon: '▲' },
    disconnected: { label: 'OFFLINE', icon: '▼' },
  }[status];

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <Sidebar activeTab="terminal" />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex-1 flex flex-col bg-bg-base relative overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="flex h-12 bg-bg-surface shrink-0 items-end px-4 gap-2 overflow-x-auto no-scrollbar border-b border-border-main">
              <div className="flex items-center h-full pr-6 text-sm font-bold tracking-widest text-text-1">
                CHRONOSOLE // TTY
              </div>

              <div className="flex flex-1 items-end h-full gap-1 pt-2 border-l border-border-main pl-2">
                {tabs.map((tab, i) => {
                  const isActive = tab.id === activeId;
                  return (
                    <div
                      key={tab.id}
                      onClick={() => setActiveId(tab.id)}
                      className={`group flex items-center gap-3 px-4 h-full min-w-[120px] cursor-pointer transition-colors relative ${isActive
                        ? 'bg-bg-base text-text-1 z-10 border-t-2 border-accent'
                        : 'bg-transparent hover:bg-bg-raised text-text-3 border-t-2 border-transparent'
                        }`}
                    >
                      {isActive && (
                        <div className="absolute inset-x-0 top-0 h-[1px] shadow-[0_0_12px_1px_var(--accent)] opacity-40 pointer-events-none" />
                      )}
                      <span className={`text-[8px] ${tab.status === 'connected' ? 'text-accent' : 'text-text-3'}`}>■</span>
                      <span className="text-sm font-mono font-semibold">{tab.label}</span>
                      {i < 9 && (
                        <span className={`text-[10px] border px-1 rounded transition-opacity ${isActive ? 'border-text-3 opacity-100' : 'border-border-main opacity-0 group-hover:opacity-100'
                          }`}>
                          ^{i + 1}
                        </span>
                      )}
                      {tabs.length > 1 && (
                        <span className="ml-auto text-xs opacity-0 group-hover:opacity-100 hover:text-accent transition-all" onClick={(e) => closeTab(e, tab.id)}>✕</span>
                      )}
                    </div>
                  );
                })}
                <button onClick={addTab} className="h-full px-4 text-text-3 hover:text-text-1 transition-colors mb-1">
                  +
                </button>
              </div>

              <div className="hidden lg:flex items-center h-full px-4 gap-6 font-mono text-[11px] text-text-2 border-l border-border-main">
                <div className="flex items-center gap-2">
                  <span className="text-accent text-[8px]">{statusConfig.icon}</span>
                  <span className="text-accent tracking-wider">{statusConfig.label}</span>
                </div>
                <div className="tracking-wider">{date} // {time}</div>
                <ThemeToggle />
              </div>
            </div>

            <div className="flex-1 relative bg-bg-base overflow-hidden">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`absolute inset-0 transition-opacity duration-200 ${tab.id === activeId ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'
                    }`}
                >
                  <div ref={setMountRef(tab.id)} className="w-full h-full" />
                </div>
              ))}
            </div>

            <div className="flex h-8 border-t border-border-main bg-bg-surface shrink-0 items-center px-4 justify-between font-mono text-[11px] text-text-3 tracking-widest overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-6 whitespace-nowrap">
                <div>ENV: <span className="text-accent font-bold">PRODUCTION</span></div>
                <div>ENC: <span className="text-text-1 font-bold">UTF-8</span></div>
                <div className="flex items-center gap-4 pl-6 border-l border-border-main">
                  <div className="flex items-center gap-2"><span className="border border-border-main px-1.5 rounded text-text-1 bg-bg-base">^C</span> INT</div>
                  <div className="flex items-center gap-2"><span className="border border-border-main px-1.5 rounded text-text-1 bg-bg-base">^D</span> EOF</div>
                  <div className="flex items-center gap-2"><span className="border border-border-main px-1.5 rounded text-text-1 bg-bg-base">^T</span> NEW</div>
                </div>
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap pl-4">
                <span className="text-accent text-[10px]">∿</span>
                WS // ACTIVE: {tabs.findIndex((t) => t.id === activeId) + 1}/{tabs.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
