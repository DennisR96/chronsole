"use client";

import { useEffect, useMemo, useState } from "react";
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

interface DockerContainer {
  id: string;
  fullId: string;
  name: string;
  image: string;
  imageId: string;
  state: string;
  status: string;
  created: number;
}

interface DockerImage {
  id: string;
  fullId: string;
  repoTags: string[];
  size: number;
  created: number;
  containers: number;
}

interface DockerPayload {
  containers: DockerContainer[];
  images: DockerImage[];
}

type SystemTab = "telemetry" | "docker";

export default function SystemDashboardPage() {
  const [activeTab, setActiveTab] = useState<SystemTab>("telemetry");
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "offline">(
    "connecting"
  );

  const [docker, setDocker] = useState<DockerPayload>({
    containers: [],
    images: [],
  });
  const [dockerLoading, setDockerLoading] = useState(false);
  const [dockerError, setDockerError] = useState<string | null>(null);

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

    socket.onerror = () => {
      setStatus("offline");
    };

    socket.onclose = () => {
      setStatus("offline");
    };

    return () => socket.close();
  }, []);

  const fetchDocker = async () => {
    setDockerLoading(true);
    setDockerError(null);

    try {
      const res = await fetch("/api/docker", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Failed loading Docker data");
      }

      setDocker(data);
    } catch (error) {
      setDockerError(
        error instanceof Error ? error.message : "Failed loading Docker data"
      );
    } finally {
      setDockerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "docker") {
      fetchDocker();
    }
  }, [activeTab]);

  const runDockerAction = async (
    type: "container" | "image",
    id: string,
    action: "start" | "stop" | "restart" | "remove"
  ) => {
    setDockerLoading(true);
    setDockerError(null);

    try {
      const res = await fetch("/api/docker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type, id, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Docker action failed");
      }

      await fetchDocker();
    } catch (error) {
      setDockerError(
        error instanceof Error ? error.message : "Docker action failed"
      );
    } finally {
      setDockerLoading(false);
    }
  };

  const runningContainers = useMemo(
    () => docker.containers.filter((c) => c.state === "running").length,
    [docker.containers]
  );

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 GB";

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unit = 0;

    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }

    return `${size.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return "0s";

    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m ${s}s`;
  };

  const formatDate = (unixSeconds: number) => {
    if (!unixSeconds) return "UNKNOWN";

    return new Date(unixSeconds * 1000).toLocaleString();
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden font-mono text-sm">
      <Sidebar activeTab="system" />

      <div className="flex-1 flex flex-col min-w-0 bg-bg-surface">
        <div className="flex h-12 bg-bg-surface shrink-0 items-center px-6 justify-between border-b border-border-main">
          <div className="font-bold tracking-widest text-text-1">
            CHRONOSOLE // SYSTEM_CORE
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className={`text-[8px] ${status === "online" ? "text-accent" : "text-text-3"
                  }`}
              >
                ■
              </span>
              <span
                className={
                  status === "online" ? "text-accent" : "text-text-3"
                }
              >
                {status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="border-b border-border-main bg-bg-surface px-6 h-12 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`px-4 py-2 rounded-lg border text-[11px] font-bold tracking-widest transition ${activeTab === "telemetry"
                ? "border-accent text-accent bg-bg-base"
                : "border-border-main text-text-3 hover:text-text-1"
              }`}
          >
            TELEMETRY
          </button>

          <button
            onClick={() => setActiveTab("docker")}
            className={`px-4 py-2 rounded-lg border text-[11px] font-bold tracking-widest transition ${activeTab === "docker"
                ? "border-accent text-accent bg-bg-base"
                : "border-border-main text-text-3 hover:text-text-1"
              }`}
          >
            DOCKER
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto no-scrollbar bg-bg-base space-y-6">
          {activeTab === "telemetry" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-border-main bg-bg-surface rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-border-main pb-2">
                    <span className="font-bold text-text-1 tracking-wider">
                      CPU UTILIZATION
                    </span>
                    <span className="text-accent font-bold text-lg">
                      {metrics?.cpu ?? 0}%
                    </span>
                  </div>

                  <div className="w-full bg-bg-base h-4 rounded border border-border-main overflow-hidden relative">
                    <div
                      className="bg-accent h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(204,255,0,0.4)]"
                      style={{ width: `${metrics?.cpu ?? 0}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 text-[11px] text-text-2 pt-1">
                    <div>
                      LOAD 1M:{" "}
                      <span className="text-text-1 font-bold">
                        {metrics?.loadAvg?.[0]?.toFixed(2) ?? "0.00"}
                      </span>
                    </div>
                    <div>
                      LOAD 5M:{" "}
                      <span className="text-text-1 font-bold">
                        {metrics?.loadAvg?.[1]?.toFixed(2) ?? "0.00"}
                      </span>
                    </div>
                    <div>
                      LOAD 15M:{" "}
                      <span className="text-text-1 font-bold">
                        {metrics?.loadAvg?.[2]?.toFixed(2) ?? "0.00"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border border-border-main bg-bg-surface rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-border-main pb-2">
                    <span className="font-bold text-text-1 tracking-wider">
                      RAM ALLOCATION
                    </span>
                    <span className="text-accent font-bold text-lg">
                      {metrics?.memory?.percentage ?? 0}%
                    </span>
                  </div>

                  <div className="w-full bg-bg-base h-4 rounded border border-border-main overflow-hidden relative">
                    <div
                      className="bg-accent h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(204,255,0,0.4)]"
                      style={{
                        width: `${metrics?.memory?.percentage ?? 0}%`,
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 text-[11px] text-text-2 pt-1">
                    <div>
                      ASSIGNED:{" "}
                      <span className="text-text-1 font-bold">
                        {formatBytes(metrics?.memory?.used ?? 0)}
                      </span>
                    </div>
                    <div>
                      CAPACITY:{" "}
                      <span className="text-text-1 font-bold">
                        {formatBytes(metrics?.memory?.total ?? 0)}
                      </span>
                    </div>
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
                    <span className="text-text-1 font-bold uppercase">
                      {metrics?.platform ?? "UNKNOWN"}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-border-sub py-1">
                    <span>ARCHITECTURE</span>
                    <span className="text-text-1 font-bold uppercase">
                      {metrics?.arch ?? "UNKNOWN"}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-border-sub py-1 sm:col-span-2">
                    <span>SYSTEM UPTIME</span>
                    <span className="text-accent font-bold">
                      {formatUptime(metrics?.uptime ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "docker" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="border border-border-main bg-bg-surface rounded-xl p-5">
                  <div className="text-text-3 text-[11px] tracking-widest">
                    CONTAINERS
                  </div>
                  <div className="text-accent text-3xl font-bold mt-2">
                    {docker.containers.length}
                  </div>
                </div>

                <div className="border border-border-main bg-bg-surface rounded-xl p-5">
                  <div className="text-text-3 text-[11px] tracking-widest">
                    RUNNING
                  </div>
                  <div className="text-accent text-3xl font-bold mt-2">
                    {runningContainers}
                  </div>
                </div>

                <div className="border border-border-main bg-bg-surface rounded-xl p-5">
                  <div className="text-text-3 text-[11px] tracking-widest">
                    IMAGES
                  </div>
                  <div className="text-accent text-3xl font-bold mt-2">
                    {docker.images.length}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <div className="font-bold text-text-1 tracking-widest">
                    DOCKER CONTROL
                  </div>
                  <div className="text-text-3 text-[11px] mt-1">
                    Manage local containers and images
                  </div>
                </div>

                <button
                  onClick={fetchDocker}
                  disabled={dockerLoading}
                  className="px-4 py-2 rounded-lg border border-border-main text-text-1 hover:text-accent hover:border-accent disabled:opacity-50 text-[11px] font-bold tracking-widest"
                >
                  {dockerLoading ? "SYNCING..." : "REFRESH"}
                </button>
              </div>

              {dockerError && (
                <div className="border border-red-500/50 bg-red-500/10 rounded-xl p-4 text-red-400 text-xs">
                  {dockerError}
                </div>
              )}

              <div className="border border-border-main bg-bg-surface rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border-main font-bold text-text-1 tracking-wider">
                  CONTAINERS
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-text-3 border-b border-border-main">
                      <tr>
                        <th className="p-3">NAME</th>
                        <th className="p-3">IMAGE</th>
                        <th className="p-3">STATE</th>
                        <th className="p-3">STATUS</th>
                        <th className="p-3 text-right">ACTIONS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {docker.containers.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-5 text-center text-text-3"
                          >
                            No containers found.
                          </td>
                        </tr>
                      )}

                      {docker.containers.map((container) => (
                        <tr
                          key={container.fullId}
                          className="border-b border-border-sub last:border-0"
                        >
                          <td className="p-3 text-text-1 font-bold">
                            {container.name}
                            <div className="text-text-3 font-normal">
                              {container.id}
                            </div>
                          </td>

                          <td className="p-3 text-text-2">
                            {container.image}
                          </td>

                          <td className="p-3">
                            <span
                              className={
                                container.state === "running"
                                  ? "text-accent"
                                  : "text-text-3"
                              }
                            >
                              {container.state.toUpperCase()}
                            </span>
                          </td>

                          <td className="p-3 text-text-3">
                            {container.status}
                          </td>

                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              {container.state !== "running" && (
                                <button
                                  onClick={() =>
                                    runDockerAction(
                                      "container",
                                      container.fullId,
                                      "start"
                                    )
                                  }
                                  className="px-3 py-1 rounded border border-border-main hover:border-accent hover:text-accent"
                                >
                                  START
                                </button>
                              )}

                              {container.state === "running" && (
                                <button
                                  onClick={() =>
                                    runDockerAction(
                                      "container",
                                      container.fullId,
                                      "stop"
                                    )
                                  }
                                  className="px-3 py-1 rounded border border-border-main hover:border-accent hover:text-accent"
                                >
                                  STOP
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  runDockerAction(
                                    "container",
                                    container.fullId,
                                    "restart"
                                  )
                                }
                                className="px-3 py-1 rounded border border-border-main hover:border-accent hover:text-accent"
                              >
                                RESTART
                              </button>

                              <button
                                onClick={() =>
                                  runDockerAction(
                                    "container",
                                    container.fullId,
                                    "remove"
                                  )
                                }
                                className="px-3 py-1 rounded border border-red-500/40 text-red-400 hover:border-red-400"
                              >
                                REMOVE
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border border-border-main bg-bg-surface rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border-main font-bold text-text-1 tracking-wider">
                  IMAGES
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-text-3 border-b border-border-main">
                      <tr>
                        <th className="p-3">REPOSITORY</th>
                        <th className="p-3">IMAGE ID</th>
                        <th className="p-3">SIZE</th>
                        <th className="p-3">CREATED</th>
                        <th className="p-3 text-right">ACTIONS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {docker.images.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="p-5 text-center text-text-3"
                          >
                            No images found.
                          </td>
                        </tr>
                      )}

                      {docker.images.map((image) => (
                        <tr
                          key={image.fullId}
                          className="border-b border-border-sub last:border-0"
                        >
                          <td className="p-3 text-text-1 font-bold">
                            {image.repoTags.join(", ")}
                          </td>

                          <td className="p-3 text-text-3">{image.id}</td>

                          <td className="p-3 text-text-2">
                            {formatBytes(image.size)}
                          </td>

                          <td className="p-3 text-text-3">
                            {formatDate(image.created)}
                          </td>

                          <td className="p-3">
                            <div className="flex justify-end">
                              <button
                                onClick={() =>
                                  runDockerAction(
                                    "image",
                                    image.fullId,
                                    "remove"
                                  )
                                }
                                className="px-3 py-1 rounded border border-red-500/40 text-red-400 hover:border-red-400"
                              >
                                REMOVE
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
