/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studio", {
  phase: "04",
  runtime: "electron",
  omp: "emulator",
  chat: {
    start: () => ipcRenderer.invoke("studio:chat:start"),
    send: (message) => ipcRenderer.invoke("studio:chat:send", message),
    stop: () => ipcRenderer.invoke("studio:chat:stop"),
    onEvent: (listener) => {
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on("studio:chat:event", handler);
      return () => ipcRenderer.removeListener("studio:chat:event", handler);
    },
  },
});
