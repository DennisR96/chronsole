'use client';
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

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

  useEffect(() => {
    if (isInitialized.current || !terminalRef.current) return;
    isInitialized.current = true;

    let socket: WebSocket;
    let resizeObserver: ResizeObserver;

    Promise.all([
      import('@xterm/xterm'),
      import('@xterm/addon-fit'),
    ]).then(([{ Terminal }, { FitAddon }]) => {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        theme: {
          background: '#16181d',
          foreground: '#e2e4e9',
          cursor: '#f5a623',
          cursorAccent: '#16181d',
          selectionBackground: '#f5a62330',
          black: '#16181d',
          red: '#f87171',
          green: '#6ee7b7',
          yellow: '#fcd34d',
          blue: '#93c5fd',
          magenta: '#c4b5fd',
          cyan: '#67e8f9',
          white: '#e2e4e9',
          brightBlack: '#3f4251',
          brightRed: '#fca5a5',
          brightGreen: '#a7f3d0',
          brightYellow: '#fde68a',
          brightBlue: '#bfdbfe',
          brightMagenta: '#ddd6fe',
          brightCyan: '#a5f3fc',
          brightWhite: '#f8fafc',
        },
        // Nerd Font patched names first so glyphs (file icons, powerline, devicons) render.
        // Then DM Mono for the modern look. Falls back to other monos gracefully.
        fontFamily: '"JetBrainsMono Nerd Font", "JetBrains Mono NF", "JetBrains Mono Nerd Font Mono", "FiraCode Nerd Font", "Fira Code NF", "Hack Nerd Font", "MesloLGS NF", "Meslo LG S NF", "SauceCodePro Nerd Font", "DM Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace',
        fontSize: 13.5,
        // Keep lineHeight tight and letterSpacing at 0 so the cell grid matches
        // what nvim/htop/less expect — otherwise box-drawing chars don't connect
        // and full-screen TUIs miscalculate rows.
        lineHeight: 1.2,
        letterSpacing: 0,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current!);
      fitAddon.fit();

      const sendSize = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
          } catch { }
        }
      };

      socket = new WebSocket(`ws://${window.location.host}/ws`);
      socket.onopen = () => {
        setStatus('connected');
        // Re-fit AFTER paint so the container has its final size, then explicitly
        // push cols/rows to the PTY. The initial fit() before socket.onopen
        // triggered onResize while the socket was still CONNECTING (dropped),
        // and a no-op fit here wouldn't re-fire onResize — so push manually.
        requestAnimationFrame(() => {
          try { fitAddon.fit(); } catch { }
          sendSize();
        });
        term.write('\r\n  \x1b[38;5;215m◆\x1b[0m  \x1b[1mConnected\x1b[0m — shell ready\r\n\r\n');
      };
      socket.onmessage = (event) => term.write(event.data);
      socket.onclose = () => {
        setStatus('disconnected');
        term.write('\r\n  \x1b[38;5;203m◆\x1b[0m  Session ended\r\n');
      };
      term.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(data);
      });
      term.onResize(({ cols, rows }) => {
        if (socket.readyState === WebSocket.OPEN) {
          try { socket.send(JSON.stringify({ type: 'resize', cols, rows })); } catch { }
        }
      });

      resizeObserver = new ResizeObserver(() => {
        try { fitAddon.fit(); } catch { }
      });
      resizeObserver.observe(terminalRef.current!);

      // When web fonts finish loading, cell width changes — re-fit AND explicitly
      // push the new size, since fit() won't re-fire onResize if dimensions
      // happen to round to the same cols/rows.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          try { fitAddon.fit(); } catch { }
          sendSize();
        });
      }

      return () => {
        resizeObserver.disconnect();
        term.dispose();
        if (socket) socket.close();
      };
    });
  }, []);

  const statusConfig = {
    connected: { color: '#6ee7b7', bg: '#6ee7b714', label: 'Connected', dot: true },
    connecting: { color: '#fcd34d', bg: '#fcd34d14', label: 'Connecting…', dot: false },
    disconnected: { color: '#f87171', bg: '#f8717114', label: 'Disconnected', dot: false },
  }[status];

  return (
    <>
      <style>{`
        /* JetBrainsMono Nerd Font — patched with file/folder/powerline/devicon glyphs.
           Without this the terminal renders □ boxes where icons should appear. */
        @import url('https://cdn.jsdelivr.net/gh/mshaugh/nerdfont-webfonts/build/jetbrainsmono.css');
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: #0f1013; }

        :root {
          --bg-base:    #0f1013;
          --bg-surface: #16181d;
          --bg-raised:  #1e2029;
          --bg-overlay: #262933;
          --border:     #2e3140;
          --border-sub: #1e2029;
          --text-1:     #e2e4e9;
          --text-2:     #9ba1b0;
          --text-3:     #5a6070;
          --accent:     #f5a623;
          --accent-sub: #f5a62318;
          --radius-sm:  8px;
          --radius-md:  12px;
          --radius-lg:  16px;
          --radius-xl:  20px;
          --font-ui:    'DM Sans', system-ui, sans-serif;
          --font-mono:  'DM Mono', 'JetBrains Mono', monospace;
        }

        .root {
          display: flex;
          flex-direction: column;
          height: 100dvh;
          width: 100%;
          background: var(--bg-base);
          font-family: var(--font-ui);
          padding: 16px;
          gap: 12px;
          overflow: hidden;
        }

        /* ─── Top Bar ─── */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          padding: 0 4px;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-mark {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-sm);
          background: linear-gradient(135deg, #2a2d38, #1e2029);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 1px 3px #00000040, inset 0 1px 0 #ffffff08;
        }

        .logo-label {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .logo-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-1);
          letter-spacing: -0.01em;
        }

        .logo-sub {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-3);
          letter-spacing: 0.02em;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg-raised);
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-2);
          letter-spacing: 0.02em;
        }

        .pill-clock {
          color: var(--text-3);
          font-size: 11px;
        }

        .status-pill {
          border-color: transparent;
          font-weight: 500;
          transition: background 0.3s, color 0.3s;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }
        .status-dot.pulse { animation: pulse 1.8s ease-in-out infinite; }

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
            0 32px 64px #00000060;
          min-height: 0;
          position: relative;
        }

        /* Subtle top highlight */
        .window::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #ffffff10 40%, #ffffff10 60%, transparent);
          pointer-events: none;
          z-index: 10;
        }

        /* ─── Tab bar ─── */
        .tabbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          height: 44px;
          border-bottom: 1px solid var(--border-sub);
          background: var(--bg-surface);
          flex-shrink: 0;
          position: relative;
          z-index: 5;
        }

        .tabbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .traffic {
          display: flex;
          gap: 6px;
          align-items: center;
          margin-right: 4px;
        }

        .tl {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          position: relative;
        }
        .tl::after {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
        }
        .tl-r { background: #ff5f57; }
        .tl-y { background: #febc2e; }
        .tl-g { background: #28c840; }

        .tab {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 5px 11px;
          border-radius: var(--radius-sm);
          background: var(--bg-overlay);
          border: 1px solid var(--border);
          font-size: 12px;
          font-weight: 500;
          color: var(--text-1);
          cursor: default;
          user-select: none;
        }

        .tab-icon {
          font-size: 11px;
          opacity: 0.7;
        }

        .tab-close {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          background: var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          color: var(--text-3);
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .tab:hover .tab-close { opacity: 1; }

        .add-tab {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-3);
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .add-tab:hover {
          background: var(--bg-overlay);
          color: var(--text-2);
        }

        .tabbar-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: var(--text-3);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .icon-btn:hover {
          background: var(--bg-overlay);
          color: var(--text-2);
        }

        /* ─── Terminal body ─── */
        .term-body {
          flex: 1;
          background: #16181d;
          min-height: 0;
          position: relative;
        }

        .term-body .xterm { height: 100%; }
        .term-body .xterm-viewport { background: transparent !important; }

        /* ─── Footer bar ─── */
        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          height: 30px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border-sub);
          flex-shrink: 0;
          position: relative;
          z-index: 5;
        }

        .footer-items {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .fitem {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-3);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .fitem b {
          font-weight: 400;
          color: var(--text-2);
        }

        .fitem-sep {
          width: 1px;
          height: 12px;
          background: var(--border);
        }

        .kbd {
          display: inline-flex;
          align-items: center;
          padding: 1px 5px;
          border-radius: 4px;
          background: var(--bg-overlay);
          border: 1px solid var(--border);
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-3);
          letter-spacing: 0.04em;
        }

        /* ─── Tooltip hint (decorative) ─── */
        .hint-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          background: var(--accent-sub);
          border: 1px solid #f5a62328;
        }

        .hint-bar span {
          font-size: 10px;
          color: var(--accent);
          font-family: var(--font-mono);
        }

        .hint-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
        }

        /* Fade-in animation for the whole page */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .root { animation: fadeUp 0.35s ease both; }
      `}</style>

      <div className="root">
        {/* Top Bar */}
        <div className="topbar">
          <div className="logo">
            <div className="logo-mark">⌨️</div>
            <div className="logo-label">
              <div className="logo-title">Terminal</div>
              <div className="logo-sub">local shell · next.js</div>
            </div>
          </div>

          <div className="topbar-right">
            <div className="pill">
              <span className="pill-clock">{date}</span>
              <span className="fitem-sep" />
              <span style={{ fontWeight: 500, color: 'var(--text-2)' }}>{time}</span>
            </div>

            <div
              className="pill status-pill"
              style={{ background: statusConfig.bg, color: statusConfig.color }}
            >
              <div
                className={`status-dot ${status === 'connected' ? 'pulse' : ''}`}
                style={{ background: statusConfig.color }}
              />
              {statusConfig.label}
            </div>
          </div>
        </div>

        {/* Window */}
        <div className="window">
          {/* Tab Bar */}
          <div className="tabbar">
            <div className="tabbar-left">
              <div className="traffic">
                <div className="tl tl-r" />
                <div className="tl tl-y" />
                <div className="tl tl-g" />
              </div>

              <div className="tab">
                <span className="tab-icon">◉</span>
                bash
                <span className="tab-close">✕</span>
              </div>

              <button className="add-tab" title="New tab">+</button>
            </div>

            <div className="tabbar-right">
              <button className="icon-btn" title="Split pane">⊟</button>
              <button className="icon-btn" title="Settings">⋯</button>
            </div>
          </div>

          {/* Terminal */}
          <div className="term-body">
            <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Footer */}
          <div className="footer">
            <div className="footer-items">
              <div className="fitem">Shell <b>bash</b></div>
              <div className="fitem-sep" />
              <div className="fitem">Enc <b>UTF-8</b></div>
              <div className="fitem-sep" />
              <div className="fitem">Host <b>localhost</b></div>
              <div className="fitem-sep" />
              <div className="fitem">
                <span className="kbd">⌃C</span> interrupt &nbsp;
                <span className="kbd">⌃D</span> exit
              </div>
            </div>

            <div className="hint-bar">
              <div className="hint-dot" />
              <span>ws://localhost/ws</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
