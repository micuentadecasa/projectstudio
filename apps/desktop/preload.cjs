/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studio", {
  phase: "04",
  runtime: "electron",
  omp: "real",
  projects: {
    list: () => ipcRenderer.invoke("studio:projects:list"),
    open: () => ipcRenderer.invoke("studio:projects:open"),
    activate: (id) => ipcRenderer.invoke("studio:projects:activate", id),
    archive: (id) => ipcRenderer.invoke("studio:projects:archive", id),
  },
  project: {
    analysis: () => ipcRenderer.invoke("studio:project:analysis"),
    productshapeGraph: () => ipcRenderer.invoke("studio:project:productshape-graph"),
    savePdacEdit: (edit) => ipcRenderer.invoke("studio:project:pdac-edit", edit),
    bootstrap: (options) => ipcRenderer.invoke("studio:project:bootstrap", options),
  },
  command: {
    submit: (command) => ipcRenderer.invoke("studio:command:submit", command),
  },
  chat: {
    start: () => ipcRenderer.invoke("studio:chat:start"),
    stop: () => ipcRenderer.invoke("studio:chat:stop"),
    onEvent: (listener) => {
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on("studio:chat:event", handler);
      return () => ipcRenderer.removeListener("studio:chat:event", handler);
    },
  },
});
