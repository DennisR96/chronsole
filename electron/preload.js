// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chronosole", {
  isElectron: true,
  platform: process.platform,

  selectDirectory: async () => {
    return ipcRenderer.invoke("dialog:select-directory");
  },

  minimizeWindow: async () => {
    return ipcRenderer.invoke("window:minimize");
  },

  toggleMaximizeWindow: async () => {
    return ipcRenderer.invoke("window:toggle-maximize");
  },

  closeWindow: async () => {
    return ipcRenderer.invoke("window:close");
  },
});
