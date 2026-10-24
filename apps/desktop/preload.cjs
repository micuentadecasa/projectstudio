/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("studio", {
  phase: "01",
  runtime: "electron",
  omp: "prepared",
});
