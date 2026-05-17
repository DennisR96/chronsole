const { createServer } = require("http");
const { parse } = require("url");
const crypto = require("crypto");
const next = require("next");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const os = require("os");

process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[server] unhandledRejection:", err);
});

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = Number(process.env.PORT || 3000);

const nextApp = next({
  dev,
  hostname,
  port,
  dir: __dirname,
});

const handle = nextApp.getRequestHandler();

const shell = os.platform() === "win32" ? "powershell.exe" : "/bin/zsh";

nextApp.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const terminalWss = new WebSocketServer({ noServer: true });
  const terminalSessions = new Map();

  terminalWss.on("connection", (ws, request) => {
    const { query } = parse(request.url || "", true);

    const sessionId =
      typeof query.sessionId === "string" && query.sessionId.trim()
        ? query.sessionId.trim()
        : crypto.randomUUID();

    let session = terminalSessions.get(sessionId);

    if (!session) {
      const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.cwd(),
        env: process.env,
      });

      session = {
        id: sessionId,
        ptyProcess,
        sockets: new Set(),
        buffer: "",
      };

      ptyProcess.onData((data) => {
        session.buffer += data;

        if (session.buffer.length > 200000) {
          session.buffer = session.buffer.slice(-200000);
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
      });

      terminalSessions.set(sessionId, session);
    }

    session.sockets.add(ws);

    ws.send(
      JSON.stringify({
        type: "session",
        sessionId,
      }),
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
            Math.max(1, Math.floor(msg.rows)),
          );
          return;
        }

        if (msg.type === "close-session") {
          try {
            session.ptyProcess.kill();
          } catch { }

          terminalSessions.delete(sessionId);
          ws.close();
          return;
        }
      } catch { }

      session.ptyProcess.write(text);
    });

    ws.on("close", () => {
      session.sockets.delete(ws);
    });

    ws.on("error", () => {
      session.sockets.delete(ws);
    });
  });

  const systemWss = new WebSocketServer({ noServer: true });

  systemWss.on("connection", (ws) => {
    const sendMetrics = () => {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;

      if (ws.readyState === ws.OPEN) {
        ws.send(
          JSON.stringify({
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
          }),
        );
      }
    };

    sendMetrics();

    const interval = setInterval(sendMetrics, 1000);

    ws.on("close", () => clearInterval(interval));
    ws.on("error", () => clearInterval(interval));
  });

  const nextUpgradeHandler =
    typeof nextApp.getUpgradeHandler === "function"
      ? nextApp.getUpgradeHandler()
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

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
