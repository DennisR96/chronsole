"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

interface SystemMetrics {
  cpu: number;
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  uptime: number;
  loadAvg: number[];
  platform: string;
  arch: string;
}

export default function SystemDashboardPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "offline">("connecting");

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/sys-ws`);

    socket.onopen = () => setStatus("online");
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMetrics(data);
      } catch (e) {
        console.error("Failed parsing telemetry package", e);
      }
    };
    socket.onclose = () => setStatus("offline");

    return () => socket.close();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 GB";
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden font-mono text-sm">
      {/* Fixed activeTab identifier match */}
      <Sidebar activeTab="system" />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex h-12 bg-bg-surface shrink-0 items-center px-6 justify-between border-b border-border-main">
          <div className="font-bold tracking-widest text-text-1">
            CHRONOSOLE // TELEMETRY_CORE
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-2">
              <span className={`text-[8px] ${status === "online" ? "text-accent" : "text-text-3"}`}>■</span>
              <span className={status === "online" ? "text-accent" : "text-text-3"}>
                {status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto no-scrollbar bg-bg-base space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-border-main bg-bg-surface rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-border-main pb-2">
                <span className="font-bold text-text-1 tracking-wider">CPU UTILIZATION</span>
                <span className="text-accent font-bold text-lg">{metrics?.cpu ?? 0}%</span>
              </div>
              <div className="w-full bg-bg-base h-4 rounded border border-border-main overflow-hidden relative">
                <div
                  className="bg-accent h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(204,255,0,0.4)]"
                  style={{ width: `${metrics?.cpu ?? 0}%` }}
                />
              </div>
              {/* Added optional chaining array safeguards metrics?.loadAvg?.[index] */}
              <div className="grid grid-cols-3 text-[11px] text-text-2 pt-1">
                <div>LOAD 1M: <span className="text-text-1 font-bold">{metrics?.loadAvg?.[0]?.toFixed(2) ?? "0.00"}</span></div>
                <div>LOAD 5M: <span className="text-text-1 font-bold">{metrics?.loadAvg?.[1]?.toFixed(2) ?? "0.00"}</span></div>
                <div>LOAD 15M: <span className="text-text-1 font-bold">{metrics?.loadAvg?.[2]?.toFixed(2) ?? "0.00"}</span></div>
              </div>
            </div>

            <div className="border border-border-main bg-bg-surface rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-border-main pb-2">
                <span className="font-bold text-text-1 tracking-wider">RAM ALLOCATION</span>
                <span className="text-accent font-bold text-lg">{metrics?.memory?.percentage ?? 0}%</span>
              </div>
              <div className="w-full bg-bg-base h-4 rounded border border-border-main overflow-hidden relative">
                <div
                  className="bg-accent h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(204,255,0,0.4)]"
                  style={{ width: `${metrics?.memory?.percentage ?? 0}%` }}
                />
              </div>
              <div className="grid grid-cols-2 text-[11px] text-text-2 pt-1">
                <div>ASSIGNED: <span className="text-text-1 font-bold">{formatBytes(metrics?.memory?.used ?? 0)}</span></div>
                <div>CAPACITY: <span className="text-text-1 font-bold">{formatBytes(metrics?.memory?.total ?? 0)}</span></div>
              </div>
            </div>
          </div>

          <div className="border border-border-main bg-bg-surface rounded-xl p-5">
            <div className="font-bold text-text-1 tracking-wider border-b border-border-main pb-2 mb-4">
              HARDWARE & ENVIRONMENT HOST DETAILS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-text-2">
              <div className="flex justify-between border-b border-border-sub py-1">
                <span>OS PLATFORM</span>
                <span className="text-text-1 font-bold uppercase">{metrics?.platform ?? "UNKNOWN"}</span>
              </div>
              <div className="flex justify-between border-b border-border-sub py-1">
                <span>ARCHITECTURE</span>
                <span className="text-text-1 font-bold uppercase">{metrics?.arch ?? "UNKNOWN"}</span>
              </div>
              <div className="flex justify-between border-b border-border-sub py-1 sm:col-span-2">
                <span>SYSTEM UPTIME</span>
                <span className="text-accent font-bold">{formatUptime(metrics?.uptime ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
