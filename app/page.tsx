"use client";

import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";

export default function LandingPage() {
  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative selection:bg-accent/20 selection:text-accent">
      <Sidebar activeTab="home" />

      <main className="flex-1 bg-bg-surface text-text-1 flex flex-col relative overflow-hidden font-mono">
        {/* Moving dark-purple terminal background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none bg-bg-surface">
          {/* Base dark gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(124,58,237,0.09),transparent_30%),radial-gradient(circle_at_75%_65%,rgba(76,29,149,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_30%),var(--color-bg-surface)]" />

          {/* Main moving grid */}
          <div className="terminal-grid absolute inset-0 opacity-[0.11]" />

          {/* Larger secondary grid */}
          <div className="terminal-grid-large absolute inset-0 opacity-[0.065]" />

          {/* Slow purple sweep */}
          <div className="terminal-sweep absolute -inset-[45%] blur-3xl opacity-55" />

          {/* Floating purple glow 1 */}
          <div className="terminal-orb-one absolute left-[14%] top-[18%] h-[520px] w-[520px] rounded-full bg-accent/14 blur-[150px]" />

          {/* Floating purple glow 2 */}
          <div className="terminal-orb-two absolute right-[10%] bottom-[10%] h-[420px] w-[420px] rounded-full bg-purple-950/30 blur-[160px]" />

          {/* Horizontal scanner line */}
          <div className="terminal-scan absolute left-0 top-0 h-24 w-full bg-gradient-to-b from-transparent via-accent/8 to-transparent blur-sm" />

          {/* Heavy vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.74)_76%),linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.6)_100%)]" />

          {/* CRT scanlines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.22)_50%)] bg-[length:100%_4px] opacity-32" />

          {/* Noise */}
          <div className="terminal-noise absolute -inset-[20%] opacity-[0.045]" />

          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-65 shadow-[0_0_14px_var(--color-accent)]" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-8">
          <div className="w-full max-w-3xl space-y-12 animate-fade-in-up">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[11px] tracking-widest text-accent font-semibold drop-shadow-[0_0_10px_var(--color-accent)]">
                <span className="w-2 h-2 bg-accent animate-pulse shadow-[0_0_10px_var(--color-accent)]" />
                SYS.STATUS: ONLINE // AWAITING HANDSHAKE
              </div>

              <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-text-1 via-violet-100 to-text-3 font-chakra relative inline-block drop-shadow-[0_0_35px_rgba(124,58,237,0.14)]">
                CHRONOSOLE
              </h1>

              <p className="text-text-2 text-lg md:text-xl max-w-xl leading-relaxed border-l-2 border-accent/30 pl-4">
                Advanced hardware terminal interface. Gain direct command-line
                access to the core systems and operations framework.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-text-3 border-y border-border-main py-6 bg-gradient-to-r from-transparent via-bg-base/40 to-transparent backdrop-blur-[2px]">
              <div className="flex flex-col gap-1 hover:text-text-1 transition-colors">
                <span className="text-text-2">PROTOCOL</span>
                <span className="font-semibold">WSS // SECURE</span>
              </div>

              <div className="flex flex-col gap-1 hover:text-text-1 transition-colors">
                <span className="text-text-2">LATENCY</span>
                <span className="font-semibold text-accent drop-shadow-[0_0_5px_var(--color-accent)]">
                  12ms (LOCAL)
                </span>
              </div>

              <div className="flex flex-col gap-1 hover:text-text-1 transition-colors">
                <span className="text-text-2">ENCRYPTION</span>
                <span className="font-semibold">AES-256-GCM</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4">
              <Link
                href="/cli"
                className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-bg-surface bg-accent transition-all duration-300 overflow-hidden shadow-[0_0_38px_var(--color-accent-sub)]"
              >
                <div className="absolute inset-0 bg-bg-surface translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />

                <span className="absolute inset-0 border border-accent scale-[1.05] opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300" />

                <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-bg-surface z-10" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-bg-surface z-10" />

                <span className="tracking-widest flex items-center gap-3 relative z-10 group-hover:text-accent transition-colors duration-300">
                  [ INITIALIZE_SESSION ]
                  <svg
                    className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      strokeWidth="2"
                      d="M5 12h14M12 5l7 7-7 7"
                    />
                  </svg>
                </span>
              </Link>

              <div className="text-xs text-text-3 hidden sm:flex items-center gap-2">
                <span>Press</span>
                <kbd className="border border-border-main px-2 py-1 rounded text-text-2 bg-bg-base shadow-[inset_0_-1px_0_var(--color-border-main)] font-sans">
                  ENTER
                </kbd>
                <span>to launch</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom status bar */}
        <div className="relative z-10 p-6 flex justify-between items-end text-[10px] text-text-3 tracking-widest border-t border-border-main bg-bg-surface/70 backdrop-blur-xl shadow-[0_-24px_80px_rgba(0,0,0,0.55)] shrink-0">
          <div className="flex flex-col gap-1.5">
            <span>{">"} SYSTEM BOOT SEQUENCE COMPLETED...</span>
            <span>{">"} ESTABLISHING SECURE TUNNEL...</span>
            <span className="text-accent flex items-center gap-1 drop-shadow-[0_0_6px_var(--color-accent)]">
              {">"} READY FOR INPUT{" "}
              <span className="w-1.5 h-3 bg-accent animate-blink block shadow-[0_0_8px_var(--color-accent)]" />
            </span>
          </div>

          <div className="text-right hidden sm:block opacity-50">
            SYS.TERM // 2026.1
          </div>
        </div>
      </main>
    </div>
  );
}
