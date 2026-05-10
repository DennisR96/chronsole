const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const os = require('os');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const shell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh';

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME,
      env: process.env,
    });

    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    ws.on('message', (message) => {
      const text = message.toString();

      // Try to parse as a control message (e.g. resize) first.
      // Raw keystrokes are never valid JSON, so this is safe and fast.
      try {
        const msg = JSON.parse(text);

        if (msg.type === 'resize' && msg.cols && msg.rows) {
          ptyProcess.resize(
            Math.max(1, Math.floor(msg.cols)),
            Math.max(1, Math.floor(msg.rows))
          );
          return; // Do not forward resize events to the shell as keystrokes
        }
      } catch {
        // Not JSON — treat as raw terminal input
      }

      ptyProcess.write(text);
    });

    ws.on('close', () => {
      ptyProcess.kill();
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '');
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
