const { createServer } = require("http");
const { parse } = require("url");
const crypto = require("crypto");
const next = require("next");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const os = require("os");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const shell = os.platform() === "win32" ? "powershell.exe" : "/bin/zsh";

const TERMINAL_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const TERMINAL_BUFFER_LIMIT = 200_000;

function getCpuUsageSample(previousCpus) {
  const cpus = os.cpus();

  if (!previousCpus) {
    return {
      usage: 0,
      cpus,
    };
  }

  let idleDiff = 0;
  let totalDiff = 0;

  cpus.forEach((cpu, index) => {
    const previousCpu = previousCpus[index];

    const previousIdle = previousCpu.times.idle;
    const currentIdle = cpu.times.idle;

    const previousTotal = Object.values(previousCpu.times).reduce(
      (sum, value) => sum + value,
      0
    );

    const currentTotal = Object.values(cpu.times).reduce(
      (sum, value) => sum + value,
      0
    );

    idleDiff += currentIdle - previousIdle;
    totalDiff += currentTotal - previousTotal;
  });

  const usage =
    totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);

  return {
    usage: Math.max(0, Math.min(100, usage)),
    cpus,
  };
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  /**
   * Persistent CLI terminal sessions
   * Route: /ws?sessionId=...
   */
  const terminalWss = new WebSocketServer({ noServer: true });
  const terminalSessions = new Map();

  function createTerminalSession(sessionId) {
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: process.env,
    });

    const session = {
      id: sessionId,
      ptyProcess,
      sockets: new Set(),
      buffer: "",
      killTimer: null,
    };

    ptyProcess.onData((data) => {
      session.buffer += data;

      if (session.buffer.length > TERMINAL_BUFFER_LIMIT) {
        session.buffer = session.buffer.slice(-TERMINAL_BUFFER_LIMIT);
      }

      for (const socket of session.sockets) {
        if (socket.readyState === socket.OPEN) {
          socket.send(data);
        }
      }
    });

    ptyProcess.onExit(() => {
      terminalSessions.delete(sessionId);

      for (const socket of session.sockets) {
        try {
          socket.close();
        } catch { }
      }

      session.sockets.clear();

      if (session.killTimer) {
        clearTimeout(session.killTimer);
        session.killTimer = null;
      }
    });

    terminalSessions.set(sessionId, session);

    return session;
  }

  function getTerminalSession(sessionId) {
    const existing = terminalSessions.get(sessionId);

    if (existing) {
      if (existing.killTimer) {
        clearTimeout(existing.killTimer);
        existing.killTimer = null;
      }

      return existing;
    }

    return createTerminalSession(sessionId);
  }

  function closeTerminalSession(session) {
    if (session.killTimer) {
      clearTimeout(session.killTimer);
      session.killTimer = null;
    }

    terminalSessions.delete(session.id);

    for (const socket of session.sockets) {
      try {
        socket.close();
      } catch { }
    }

    session.sockets.clear();

    try {
      session.ptyProcess.kill();
    } catch { }
  }

  function scheduleTerminalCleanup(session) {
    if (session.sockets.size > 0) return;
    if (session.killTimer) return;

    session.killTimer = setTimeout(() => {
      if (session.sockets.size === 0) {
        closeTerminalSession(session);
      }
    }, TERMINAL_IDLE_TIMEOUT_MS);
  }

  terminalWss.on("connection", (ws, request) => {
    const { query } = parse(request.url || "", true);

    const sessionId =
      typeof query.sessionId === "string" && query.sessionId.trim()
        ? query.sessionId.trim()
        : crypto.randomUUID();

    const session = getTerminalSession(sessionId);

    session.sockets.add(ws);

    ws.send(
      JSON.stringify({
        type: "session",
        sessionId,
      })
    );

    if (session.buffer) {
      ws.send(session.buffer);
    }

    ws.on("message", (message) => {
      const text = message.toString();

      try {
        const msg = JSON.parse(text);

        if (msg.type === "resize" && msg.cols && msg.rows) {
          session.ptyProcess.resize(
            Math.max(1, Math.floor(msg.cols)),
            Math.max(1, Math.floor(msg.rows))
          );
          return;
        }

        if (msg.type === "close-session") {
          closeTerminalSession(session);
          return;
        }
      } catch {
        // Not JSON, so treat it as raw terminal input.
      }

      session.ptyProcess.write(text);
    });

    ws.on("close", () => {
      session.sockets.delete(ws);
      scheduleTerminalCleanup(session);
    });

    ws.on("error", () => {
      session.sockets.delete(ws);
      scheduleTerminalCleanup(session);
    });
  });

  /**
   * System telemetry WebSocket
   * Route: /sys-ws
   */
  const systemWss = new WebSocketServer({ noServer: true });

  systemWss.on("connection", (ws) => {
    let previousCpus = os.cpus();

    const sendMetrics = () => {
      try {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        const cpuSample = getCpuUsageSample(previousCpus);
        previousCpus = cpuSample.cpus;

        const metrics = {
          cpu: cpuSample.usage,
          memory: {
            total: totalMemory,
            used: usedMemory,
            free: freeMemory,
            percentage:
              totalMemory === 0
                ? 0
                : Math.round((usedMemory / totalMemory) * 100),
          },
          uptime: os.uptime(),
          loadAvg: os.loadavg(),
          platform: os.platform(),
          arch: os.arch(),
        };

        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(metrics));
        }
      } catch {
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              error: "Failed to collect system metrics",
            })
          );
        }
      }
    };

    sendMetrics();

    const interval = setInterval(sendMetrics, 1000);

    ws.on("close", () => {
      clearInterval(interval);
    });

    ws.on("error", () => {
      clearInterval(interval);
    });
  });

  /**
   * Let Next.js handle its own upgrade requests.
   * This is needed for /_next/webpack-hmr in development.
   */
  const nextUpgradeHandler =
    typeof app.getUpgradeHandler === "function"
      ? app.getUpgradeHandler()
      : null;

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = parse(request.url || "");

    if (pathname === "/ws") {
      terminalWss.handleUpgrade(request, socket, head, (ws) => {
        terminalWss.emit("connection", ws, request);
      });
      return;
    }

    if (pathname === "/sys-ws") {
      systemWss.handleUpgrade(request, socket, head, (ws) => {
        systemWss.emit("connection", ws, request);
      });
      return;
    }

    if (nextUpgradeHandler) {
      nextUpgradeHandler(request, socket, head);
      return;
    }

    socket.destroy();
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
