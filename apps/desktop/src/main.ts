import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDirectory, "../../..");
const projectRoot = resolve(process.env.PROJECTSTUDIO_PROJECT_ROOT ?? workspaceRoot);
const projectName = basename(projectRoot);
const adapterModuleUrl = pathToFileURL(join(workspaceRoot, "dist/packages/omp-bridge/src/omp-adapter.js")).href;

type AdapterEvent = Record<string, unknown>;
type ChatAdapter = {
  readonly status: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  prompt: (message: string) => Promise<{ requestId: string; command: string; accepted: boolean }>;
  on: (event: "event", listener: (payload: AdapterEvent) => void) => ChatAdapter;
};
type AdapterConstructor = new (options: {
  command: string;
  args: string[];
  cwd: string;
  sessionKey: string;
  hostTools: Array<{ name: string; description: string; parameters: Record<string, unknown>; handler: () => Promise<unknown> }>;
}) => ChatAdapter;

let mainWindow: BrowserWindow | undefined;
let chatAdapter: ChatAdapter | undefined;
let chatStart: Promise<void> | undefined;

function adapterArguments(): { command: string; args: string[] } {
  const sessionDirectory = join(workspaceRoot, ".tmp", "omp-sessions");
  mkdirSync(sessionDirectory, { recursive: true });
  return {
    command: process.env.OMP_BIN ?? "omp",
    args: ["--mode", "rpc", "--session-dir", sessionDirectory, "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", projectRoot],
  };
}

async function getChatAdapter(): Promise<ChatAdapter> {
  if (chatAdapter) return chatAdapter;
  // The bridge is compiled by the root build before Electron starts; this keeps the process boundary explicit.
  const bridge = await import(adapterModuleUrl) as unknown as { OmpAdapter: AdapterConstructor };
  const processArguments = adapterArguments();
  chatAdapter = new bridge.OmpAdapter({
    ...processArguments,
    cwd: projectRoot,
    sessionKey: `${projectName}/thread-main`,
    hostTools: [{
      name: "studio_task_progress",
      description: "Registra progreso interno de una tarea de ProjectStudio.",
      parameters: { type: "object", properties: { step: { type: "string" } }, additionalProperties: false },
      handler: async () => ({ accepted: true }),
    }],
  });
  chatAdapter.on("event", (event) => mainWindow?.webContents.send("studio:chat:event", event));
  return chatAdapter;
}

async function startChat(): Promise<{ mode: string; status: string; projectName: string; projectRoot: string }> {
  const adapter = await getChatAdapter();
  if (!chatStart) {
    chatStart = adapter.start().catch((error: unknown) => {
      chatStart = undefined;
      throw error;
    });
  }
  await chatStart;
  return { mode: "real", status: adapter.status, projectName, projectRoot };
}

function installChatIpc(): void {
  ipcMain.handle("studio:chat:start", async () => {
    try {
      return await startChat();
    } catch (error) {
      return { mode: "real", status: "failed", projectName, projectRoot, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("studio:chat:send", async (_event, message: unknown) => {
    if (typeof message !== "string" || !message.trim()) throw new Error("chat message must be a non-empty string");
    const adapter = await getChatAdapter();
    await startChat();
    return adapter.prompt(message);
  });
  ipcMain.handle("studio:chat:stop", async () => {
    if (chatAdapter) await chatAdapter.stop();
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: "ProjectStudio",
    backgroundColor: "#101722",
    webPreferences: {
      preload: join(currentDirectory, "..", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;
  void window.loadFile(join(currentDirectory, "renderer", "index.html"));
  return window;
}

function installMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "ProjectStudio",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { role: "togglefullscreen" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

installChatIpc();
app.whenReady().then(() => {
  installMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  void chatAdapter?.stop();
  if (process.platform !== "darwin") app.quit();
});
