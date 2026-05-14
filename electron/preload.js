// electron/preload.js
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("chronosole", {
  isElectron: true,
  platform: process.platform,
});
