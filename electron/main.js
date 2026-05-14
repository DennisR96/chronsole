// electron/main.js
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;

let mainWindow = null;
let nextProcess = null;

const APP_URL = "http://localhost:3000";

function startNextServer() {
  const projectRoot = path.join(__dirname, "..");

  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = isDev ? ["run", "dev:next"] : ["run", "start:next"];

  nextProcess = spawn(command, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: isDev ? "development" : "production",
      ELECTRON: "true",
    },
    stdio: "inherit",
    shell: false,
  });

  nextProcess.on("exit", (code) => {
    console.log(`[electron] Next server exited with code ${code}`);
  });

  nextProcess.on("error", (error) => {
    console.error("[electron] Failed to start Next server:", error);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: "CHRONOSOLE",
    backgroundColor: "#050509",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),

      // Security defaults.
      nodeIntegration: false,
      contextIsolation: true,

      // Needed only because we add an Electron <webview> browser page.
      webviewTag: true,

      // Keep false unless you explicitly need Electron sandboxing.
      // nodeIntegration is still disabled above.
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.loadURL(APP_URL);

  /**
   * Any window.open / target="_blank" from the main app opens externally.
   * This prevents random extra Electron windows from being created.
   */
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  /**
   * Harden <webview> usage.
   * Remote pages must not get Node access.
   */
  mainWindow.webContents.on(
    "will-attach-webview",
    (event, webPreferences, params) => {
      delete webPreferences.preload;

      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;

      try {
        const parsedUrl = new URL(params.src);
        const allowedProtocols = ["https:", "http:"];

        if (!allowedProtocols.includes(parsedUrl.protocol)) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    }
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function stopNextServer() {
  if (!nextProcess) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", nextProcess.pid, "/f", "/t"]);
  } else {
    nextProcess.kill("SIGTERM");
  }

  nextProcess = null;
}

app.whenReady().then(() => {
  startNextServer();

  /**
   * In dev, wait-on in package.json already waits before Electron starts.
   * In production, this small delay gives the packaged Next server time to boot.
   */
  setTimeout(() => {
    createWindow();
  }, isDev ? 0 : 1500);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopNextServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
