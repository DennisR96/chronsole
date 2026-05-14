const { createServer } = require("http");
const { parse } = require("url");
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
   * CLI terminal WebSocket
   * Route: /ws
   */
  const terminalWss = new WebSocketServer({ noServer: true });

  terminalWss.on("connection", (ws) => {
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: process.env,
    });

    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    ws.on("message", (message) => {
      const text = message.toString();

      try {
        const msg = JSON.parse(text);

        if (msg.type === "resize" && msg.cols && msg.rows) {
          ptyProcess.resize(
            Math.max(1, Math.floor(msg.cols)),
            Math.max(1, Math.floor(msg.rows))
          );
          return;
        }
      } catch {
        // Not JSON, so treat it as raw terminal input.
      }

      ptyProcess.write(text);
    });

    ws.on("close", () => {
      ptyProcess.kill();
    });

    ws.on("error", () => {
      ptyProcess.kill();
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
      } catch (error) {
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
