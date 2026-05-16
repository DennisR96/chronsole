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

    frame: false,
    autoHideMenuBar: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),

      /**
       * Enables <webview> in your React/Next page.
       */
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

/**
 * Folder picker for the file explorer.
 */
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

/**
 * Optional custom window controls.
 */
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

app.whenReady().then(() => {
  /**
   * Helps embedded pages request normal browser permissions.
   * You can tighten this later per origin if needed.
   */
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

  startNextServer();

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
