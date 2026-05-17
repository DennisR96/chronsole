// electron/main.js
const {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  session,
  dialog,
} = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const isDev = !app.isPackaged;

let mainWindow = null;
let nextProcess = null;
let nextServerStarted = false;

const PORT = Number(process.env.PORT || 3000);
const APP_URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(check, 250);
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    }

    check();
  });
}

function startNextServer() {
  if (nextServerStarted) return;
  nextServerStarted = true;

  if (isDev) {
    const projectRoot = path.join(__dirname, "..");
    const command = process.platform === "win32" ? "npm.cmd" : "npm";

    nextProcess = spawn(command, ["run", "dev:next"], {
      cwd: projectRoot,
      env: {
        ...process.env,
        NODE_ENV: "development",
        ELECTRON: "true",
        PORT: String(PORT),
      },
      stdio: "inherit",
      shell: false,
    });

    nextProcess.on("exit", (code) => {
      console.log(`[electron] Next dev server exited with code ${code}`);
    });

    nextProcess.on("error", (error) => {
      console.error("[electron] Failed to start Next dev server:", error);
    });

    return;
  }

  process.env.NODE_ENV = "production";
  process.env.ELECTRON = "true";
  process.env.PORT = String(PORT);

  const appPath = app.getAppPath();
  const serverPath = path.join(appPath, "server.js");

  console.log("[electron] appPath:", appPath);
  console.log("[electron] requiring Next server:", serverPath);

  require(serverPath);
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
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) return;

      console.error("[electron] Main window failed to load:", {
        errorCode,
        errorDescription,
        validatedURL,
      });
    },
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("dialog:select-directory", async () => {
  const parentWindow = mainWindow ?? BrowserWindow.getFocusedWindow();

  const result = await dialog.showOpenDialog(parentWindow ?? undefined, {
    title: "Select working directory",
    buttonLabel: "Select Folder",
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("window:minimize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.handle("window:toggle-maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;

  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.handle("window:close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

function stopNextServer() {
  if (!nextProcess) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", nextProcess.pid, "/f", "/t"]);
  } else {
    nextProcess.kill("SIGTERM");
  }

  nextProcess = null;
}

process.on("uncaughtException", (error) => {
  console.error("[electron] uncaughtException:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[electron] unhandledRejection:", error);
});

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowedPermissions = new Set([
        "media",
        "display-capture",
        "fullscreen",
        "notifications",
        "pointerLock",
      ]);

      callback(allowedPermissions.has(permission));
    },
  );

  try {
    startNextServer();
    await waitForServer(APP_URL);
    createWindow();

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        try {
          startNextServer();
          await waitForServer(APP_URL);
          createWindow();
        } catch (error) {
          console.error("[electron] Failed to reactivate app:", error);
        }
      }
    });
  } catch (error) {
    console.error("[electron] Failed to start app:", error);
    app.quit();
  }
});

app.on("before-quit", () => {
  stopNextServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
