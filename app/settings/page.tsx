'use client';

import { useTheme } from 'next-themes';
import { Sidebar } from '@/components/Sidebar';
import { Monitor, Sun, Moon, Laptop, Sliders, ShieldAlert, Cpu } from 'lucide-react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'system', label: 'SYSTEM.CONFIG', icon: Laptop, desc: 'Inherit architecture environment host metrics' },
    { id: 'dark', label: 'DARK.MODE', icon: Moon, desc: 'Default high-contrast nocturnal mainframe core' },
    { id: 'light', label: 'LIGHT.MODE', icon: Sun, desc: 'Alternative high-luminance diagnostic interface' },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <Sidebar activeTab="settings" />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex h-12 bg-bg-surface shrink-0 items-center px-4 border-b border-border-main">
          <div className="text-sm font-bold tracking-widest text-text-1 font-sans">
            CHRONOSOLE // CONTROL_PANEL
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-bg-base p-6 md:p-8 space-y-8">
          <section className="max-w-3xl space-y-6">
            <div className="border-b border-border-main pb-2">
              <h2 className="text-sm font-mono font-bold tracking-wider text-text-1 flex items-center gap-2">
                <Sliders size={16} className="text-accent" />
                [01] VISUAL_ENVIRONMENT_SETTINGS
              </h2>
              <p className="text-xs font-mono text-text-3 mt-1">Configure active display rendering engine properties.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {themes.map((t) => {
                const isActive = theme === t.id;
                const Icon = t.icon;

                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex flex-col p-4 text-left border rounded-xl font-mono transition-all relative group overflow-hidden ${isActive
                      ? 'bg-bg-surface text-text-1 border-accent shadow-[0_0_15px_rgba(204,255,0,0.05)]'
                      : 'bg-bg-surface/50 text-text-3 border-border-main hover:border-text-3 hover:bg-bg-surface'
                      }`}
                  >
                    {isActive && (
                      <div className="absolute inset-x-0 top-0 h-[2px] bg-accent shadow-[0_0_12px_1px_var(--accent)] pointer-events-none" />
                    )}
                    <div className="flex items-center justify-between w-full mb-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-accent-sub text-accent' : 'bg-bg-base text-text-3 group-hover:text-text-2'}`}>
                        <Icon size={18} />
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 border rounded uppercase ${isActive ? 'border-accent text-accent' : 'border-border-main text-text-3'}`}>
                        {isActive ? 'ACTIVE' : 'READY'}
                      </span>
                    </div>
                    <div className="text-sm font-bold tracking-wide mb-1 text-text-1">
                      {t.label}
                    </div>
                    <div className="text-[11px] text-text-2 leading-relaxed font-sans">
                      {t.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="max-w-3xl space-y-6">
            <div className="border-b border-border-main pb-2">
              <h2 className="text-sm font-mono font-bold tracking-wider text-text-1 flex items-center gap-2">
                <Cpu size={16} className="text-text-2" />
                [02] SYSTEM_HARDWARE_SPECIFICATIONS
              </h2>
              <p className="text-xs font-mono text-text-3 mt-1">Static system diagnostic metadata readout.</p>
            </div>

            <div className="bg-bg-surface border border-border-main rounded-xl p-4 font-mono text-xs text-text-2 space-y-3">
              <div className="flex justify-between items-center py-1 border-b border-border-sub">
                <span className="text-text-3">CORE_ENGINE //</span>
                <span className="text-text-1 font-semibold">NEXTJS_v15_HYBRID</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border-sub">
                <span className="text-text-3">TERM_EMULATION //</span>
                <span className="text-text-1 font-semibold">XTERM.JS_W_CANVAS</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-text-3">NETWORK_LINK //</span>
                <span className="text-accent font-bold">WEBSOCKET_ACTIVE</span>
              </div>
            </div>
          </section>

          <section className="max-w-3xl space-y-6">
            <div className="border-b border-border-main pb-2">
              <h2 className="text-sm font-mono font-bold tracking-wider text-text-1 flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-500" />
                [03] DESTRUCTIVE_MAINTENANCE
              </h2>
              <p className="text-xs font-mono text-text-3 mt-1">Irreversible administrative pipeline control utilities.</p>
            </div>

            <div className="bg-bg-surface/30 border border-red-900/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="font-mono">
                <div className="text-xs font-bold text-text-1">PURGE_SESSION_CACHE</div>
                <div className="text-[11px] text-text-3 mt-0.5">Wipes local operational system memories, tab bindings, and transient histories.</div>
              </div>
              <button className="px-3 py-1.5 border border-red-500/40 hover:border-red-500 bg-transparent text-red-500 text-xs font-mono font-bold rounded-lg transition-colors whitespace-nowrap">
                RUN // PURGE
              </button>
            </div>
          </section>
        </div>

        <div className="flex h-8 border-t border-border-main bg-bg-surface shrink-0 items-center px-4 justify-between font-mono text-[11px] text-text-3 tracking-widest">
          <div>CFG: <span className="text-accent font-bold">READY</span></div>
          <div>LOC: <span className="text-text-1 font-bold">SETTINGS // ROOT</span></div>
        </div>
      </div>
    </div>
  );
}
