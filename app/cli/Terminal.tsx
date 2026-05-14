'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTheme } from 'next-themes';
import 'xterm/css/xterm.css';

interface TerminalProps {
  isActive: boolean;
}

export default function TerminalComponent({ isActive }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!terminalRef.current) return;

    let ws: WebSocket;
    let renderTimeout: NodeJS.Timeout;
    const isDark = resolvedTheme === 'dark';

    const term = new Terminal({
      cursorBlink: false,
      cursorStyle: 'block',
      fontFamily: '"JetBrainsMono Nerd Font", "JetBrainsMonoNL Nerd Font", var(--font-mono), "JetBrains Mono", monospace',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 1.5,
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
      },
    });

    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key.toLowerCase() === 't') {
          return false;
        }
      }
      return true;
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    renderTimeout = setTimeout(() => {
      requestAnimationFrame(() => {
        try {
          if (!terminalRef.current) return;
          fitAddon.fit();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
          }
        } catch (error) {
          console.warn('Xterm fit deferred', error);
        }
      });
    }, 50);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols || 80, rows: term.rows || 24 }));
      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data);
      });
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      });
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') term.write(event.data);
      else if (event.data instanceof Blob) term.write(await event.data.text());
    };

    const handleWindowResize = () => {
      try { if (fitAddonRef.current) fitAddonRef.current.fit(); } catch (e) { }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(renderTimeout);
      window.removeEventListener('resize', handleWindowResize);
      if (term) term.dispose();
      if (ws) ws.close();
    };
  }, [resolvedTheme]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => {
        try { fitAddonRef.current?.fit(); } catch (error) { }
      }, 50);
    }
  }, [isActive]);

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-300 ${isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
        }`}
    >
      <div ref={terminalRef} className="w-full h-full p-2 sm:p-4" />
    </div>
  );
}
