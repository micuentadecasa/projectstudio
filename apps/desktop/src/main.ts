import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDirectory, "../../..");
let projectRoot = resolve(process.env.PROJECTSTUDIO_PROJECT_ROOT ?? workspaceRoot);
let projectName = basename(projectRoot);
type AgentRuntime = {
  start: (command: { workflow: "brownfield-discovery" | "architecture-documentation" | "architecture-planning"; prompt: string }, context: { projectId: string; threadId: string; runId: string; requestId: string }) => Promise<{ ompRequestId?: string; status: string }>;
  startChat: () => Promise<{ status: string }>;
  stop: () => void;
};

type WorkerResult = { status: string; ompRequestId?: string };

class AgentWorkerRuntime implements AgentRuntime {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<string, { resolve: (result: WorkerResult) => void; reject: (error: Error) => void }>();
  private readonly pendingChat = new Map<string, { resolve: (result: { status: string }) => void; reject: (error: Error) => void }>();
  private buffer = "";

  constructor() {
    const workerPath = join(workspaceRoot, "dist/packages/orchestrator/src/agent-worker.js");
    const databaseDirectory = join(workspaceRoot, ".tmp");
    mkdirSync(databaseDirectory, { recursive: true });
    this.child = spawn(process.env.PROJECTSTUDIO_NODE_BIN ?? "node", [workerPath], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PROJECTSTUDIO_AGENT_DB: join(databaseDirectory, "agent-runtime.sqlite"),
        PROJECTSTUDIO_WORKSPACE_ROOT: workspaceRoot,
        PROJECTSTUDIO_PROJECT_ROOT: projectRoot,
        PROJECTSTUDIO_PARENT_PID: String(process.pid),
      },
      stdio: "pipe",
    });
    this.child.stdout.on("data", (chunk: Buffer) => this.handleOutput(chunk.toString("utf8")));
    this.child.stderr.on("data", (chunk: Buffer) => mainWindow?.webContents.send("studio:chat:event", { type: "warning", message: chunk.toString("utf8").trim() }));
    this.child.on("exit", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("agent worker stopped"));
      for (const pending of this.pendingChat.values()) pending.reject(new Error("agent worker stopped"));
      this.pending.clear();
      this.pendingChat.clear();
    });
  }

  startChat(): Promise<{ status: string }> {
    const id = randomUUID();
    this.child.stdin.write(`${JSON.stringify({ type: "chat_start", id })}\n`);
    return new Promise((resolve, reject) => this.pendingChat.set(id, { resolve, reject }));
  }

  start(
    command: { workflow: "brownfield-discovery" | "architecture-documentation" | "architecture-planning"; prompt: string },
    context: { projectId: string; threadId: string; runId: string; requestId: string },
  ): Promise<WorkerResult> {
    const id = randomUUID();
    this.child.stdin.write(`${JSON.stringify({ type: "start", id, command, context })}\n`);
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  stop(): void {
    this.child.kill();
  }

  private handleOutput(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      newline = this.buffer.indexOf("\n");
      if (!line.trim()) continue;
      try {
        this.handleMessage(JSON.parse(line) as Record<string, unknown>);
      } catch (error) {
        mainWindow?.webContents.send("studio:chat:event", { type: "error", message: `agent worker protocol error: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
  }

  private handleMessage(message: Record<string, unknown>): void {
    if (message.type === "event") {
      const event = message.event as { type?: string; status?: string };
      if (event.type === "session_settled" && bootstrapInFlight) {
        bootstrapInFlight = false;
        void writeDiscoveryMarker("completed");
      } else if ((event.type === "error" || (event.type === "status" && event.status === "failed")) && bootstrapInFlight) {
        bootstrapInFlight = false;
        void writeDiscoveryMarker("failed");
      }
      mainWindow?.webContents.send("studio:chat:event", message.event);
      return;
    }
    if ((message.type === "result" || message.type === "chat_result") && typeof message.id === "string") {
      const pending = message.type === "result" ? this.pending.get(message.id) : this.pendingChat.get(message.id);
      if (!pending) return;
      if (message.type === "result") this.pending.delete(message.id);
      else this.pendingChat.delete(message.id);
      if (typeof message.error === "string") pending.reject(new Error(message.error));
      else pending.resolve((message.result ?? { status: "failed" }) as never);
    }
  }
}

let mainWindow: BrowserWindow | undefined;
let agentRuntime: AgentRuntime | undefined;
let chatStart: Promise<void> | undefined;
let bootstrapInFlight = false;
let registryInitialized = false;
type ProjectRecord = {
  id: string;
  name: string;
  path: string;
  archived: boolean;
  lastOpenedAt: string;
  detected: { productShape: boolean; architecture: boolean };
};
type ProjectRegistry = { version: 1; activeId: string; projects: ProjectRecord[] };

function projectRegistryPath(): string {
  const directory = join(workspaceRoot, ".tmp");
  mkdirSync(directory, { recursive: true });
  return join(directory, "projectstudio-projects.json");
}

async function detectProjectSignals(path: string): Promise<ProjectRecord["detected"]> {
  const exists = async (relativePath: string): Promise<boolean> => {
    try {
      await stat(join(path, relativePath));
      return true;
    } catch {
      return false;
    }
  };
  const rootEntries = await readdir(path).catch(() => []);
  return {
    productShape: (await exists("docs/product")) || (await exists("productshape")) || rootEntries.some((entry) => entry.toLowerCase().includes("productshape")),
    architecture: (await exists("docs/architecture")) || (await exists("architecture")) || (await exists("docs/adr")) || rootEntries.some((entry) => entry.toLowerCase().includes("architecture")),
  };
}

async function readProjectRegistry(): Promise<ProjectRegistry> {
  try {
    const value = JSON.parse(await readFile(projectRegistryPath(), "utf8")) as ProjectRegistry;
    if (value.version === 1 && Array.isArray(value.projects)) {
      const currentId = createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
      if (!value.projects.some((project) => project.id === currentId)) {
        value.projects.push({ id: currentId, name: projectName, path: projectRoot, archived: false, lastOpenedAt: new Date().toISOString(), detected: await detectProjectSignals(projectRoot) });
      }
      if (!registryInitialized) value.activeId = currentId;
      registryInitialized = true;
      return value;
    }
  } catch {
    // First run or an interrupted write: rebuild from the active project.
  }
  const detected = await detectProjectSignals(projectRoot);
  return {
    version: 1,
    activeId: createHash("sha256").update(projectRoot).digest("hex").slice(0, 16),
    projects: [{ id: createHash("sha256").update(projectRoot).digest("hex").slice(0, 16), name: projectName, path: projectRoot, archived: false, lastOpenedAt: new Date().toISOString(), detected }],
  };
}

async function writeProjectRegistry(registry: ProjectRegistry): Promise<void> {
  await writeFile(projectRegistryPath(), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

async function listProjects(): Promise<ProjectRegistry> {
  const registry = await readProjectRegistry();
  for (const project of registry.projects) project.detected = await detectProjectSignals(project.path);
  await writeProjectRegistry(registry);
  return registry;
}

async function activateProject(path: string): Promise<ProjectRegistry> {
  const resolvedPath = resolve(path);
  await stat(resolvedPath);
  const registry = await readProjectRegistry();
  const id = createHash("sha256").update(resolvedPath).digest("hex").slice(0, 16);
  const existing = registry.projects.find((project) => project.id === id);
  const record = existing ?? { id, name: basename(resolvedPath), path: resolvedPath, archived: false, lastOpenedAt: new Date().toISOString(), detected: await detectProjectSignals(resolvedPath) };
  record.archived = false;
  record.lastOpenedAt = new Date().toISOString();
  record.detected = await detectProjectSignals(resolvedPath);
  if (!existing) registry.projects.push(record);
  registry.activeId = id;
  await writeProjectRegistry(registry);
  agentRuntime?.stop();
  agentRuntime = undefined;
  chatStart = undefined;
  projectRoot = resolvedPath;
  projectName = record.name;
  return registry;
}

async function chooseProject(): Promise<ProjectRegistry | null> {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"], title: "Añadir o crear proyecto local" });
  if (result.canceled || !result.filePaths[0]) return null;
  return activateProject(result.filePaths[0]);
}

async function archiveProject(id: string): Promise<ProjectRegistry> {
  const registry = await readProjectRegistry();
  const project = registry.projects.find((candidate) => candidate.id === id);
  if (!project) throw new Error("project not found");
  project.archived = true;
  if (registry.activeId === id) {
    const next = registry.projects.find((candidate) => !candidate.archived && candidate.id !== id);
    if (next) {
      registry.activeId = next.id;
      projectRoot = next.path;
      projectName = next.name;
      agentRuntime?.stop();
      agentRuntime = undefined;
      chatStart = undefined;
    }
  }
  await writeProjectRegistry(registry);
  return registry;
}
async function startChat(): Promise<{ mode: string; status: string; projectName: string; projectRoot: string }> {
  const runtime = await getAgentRuntime();
  if (!chatStart) {
    chatStart = runtime.startChat().then(() => undefined).catch((error: unknown) => {
      chatStart = undefined;
      throw error;
    });
  }
  await chatStart;
  return { mode: "real", status: "ready", projectName, projectRoot };
}
async function loadStoredAnalysis(): Promise<{ projectName: string; mermaid: string | null; report: string | null }> {
  if (projectName !== "notes") return { projectName, mermaid: null, report: null };
  try {
    const evidenceDirectory = join(workspaceRoot, "docs", "implementation", "evidence");
    const mermaid = await readFile(join(evidenceDirectory, "F05-T01-notes-productshape-cli.mermaid"), "utf8");
    const report = await readFile(join(evidenceDirectory, "F05-T01-notes-productshape-real.md"), "utf8");
    return { projectName, mermaid: mermaid.trim() || null, report: report.trim() || null };
  } catch {
    return { projectName, mermaid: null, report: null };
  }
}
type DiscoveryStatus = "running" | "completed" | "failed";
type DiscoveryMarker = { projectRoot: string; status: DiscoveryStatus; updatedAt: string };

function discoveryMarkerPath(): string {
  const projectKey = createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
  const directory = join(workspaceRoot, ".tmp", "project-discovery");
  mkdirSync(directory, { recursive: true });
  return join(directory, `${projectKey}.json`);
}

async function readDiscoveryMarker(): Promise<DiscoveryMarker | null> {
  try {
    return JSON.parse(await readFile(discoveryMarkerPath(), "utf8")) as DiscoveryMarker;
  } catch {
    return null;
  }
}

async function writeDiscoveryMarker(status: DiscoveryStatus): Promise<void> {
  const marker: DiscoveryMarker = { projectRoot, status, updatedAt: new Date().toISOString() };
  await writeFile(discoveryMarkerPath(), `${JSON.stringify(marker)}\n`, "utf8");
}

async function bootstrapDiscovery(resume: boolean): Promise<{ status: DiscoveryStatus | "stored-artifact"; started: boolean; canResume?: boolean }> {
  if (process.env.PROJECTSTUDIO_SKIP_BOOTSTRAP === "1") return { status: "completed", started: false };
  const stored = await loadStoredAnalysis();
  if (stored.mermaid) return { status: "stored-artifact", started: false };
  const previous = await readDiscoveryMarker();
  if (previous?.status === "completed") return { status: "completed", started: false };
  if (previous?.status === "running" && !resume) {
    const updatedAt = Date.parse(previous.updatedAt);
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > 30_000) return { status: "failed", started: false, canResume: true };
    return { status: "running", started: false };
  }
  if (previous?.status === "failed" && !resume) return { status: "failed", started: false, canResume: true };

  await writeDiscoveryMarker("running");
  bootstrapInFlight = true;
  try {
    await startChat();
    const runtime = await getAgentRuntime();
    const state = await runtime.start(
      {
        workflow: "brownfield-discovery",
        prompt: "Inicia el descubrimiento del proyecto sin esperar otra instrucción. Lee la documentación de producto y después el código. Publica inventario, hechos, inferencias, incógnitas y un primer diagrama Mermaid confirmado. No modifiques archivos.",
      },
      { projectId: projectName, threadId: `${projectName}/discovery`, runId: randomUUID(), requestId: randomUUID() },
    );
    if (state.status === "failed") {
      bootstrapInFlight = false;
      await writeDiscoveryMarker("failed");
      return { status: "failed", started: false, canResume: true };
    }
    return { status: "running", started: true };
  } catch (error) {
    bootstrapInFlight = false;
    await writeDiscoveryMarker("failed");
    throw error;
  }
}


async function getAgentRuntime(): Promise<AgentRuntime> {
  if (agentRuntime) return agentRuntime;
  agentRuntime = new AgentWorkerRuntime();
  return agentRuntime;
}

function installChatIpc(): void {
  ipcMain.handle("studio:projects:list", () => listProjects());
  ipcMain.handle("studio:projects:open", async () => {
    const registry = await chooseProject();
    if (!registry) return null;
    return { registry, active: registry.projects.find((project) => project.id === registry.activeId) ?? null };
  });
  ipcMain.handle("studio:projects:activate", async (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("project id is required");
    const registry = await readProjectRegistry();
    const project = registry.projects.find((candidate) => candidate.id === id);
    if (!project) throw new Error("project not found");
    const updated = await activateProject(project.path);
    return { registry: updated, active: updated.projects.find((candidate) => candidate.id === updated.activeId) ?? null };
  });
  ipcMain.handle("studio:projects:archive", (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("project id is required");
    return archiveProject(id);
  });
  ipcMain.handle("studio:project:analysis", () => loadStoredAnalysis());
  ipcMain.handle("studio:project:bootstrap", async (_event, options: unknown) => {
    const resume = typeof options === "object" && options !== null && "resume" in options && options.resume === true;
    return bootstrapDiscovery(resume);
  });
  ipcMain.handle("studio:chat:start", async () => {
    try {
      return await startChat();
    } catch (error) {
      return { mode: "real", status: "failed", projectName, projectRoot, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("studio:command:submit", async (_event, command: unknown) => {
    if (typeof command !== "object" || command === null) throw new Error("command must be an object");
    const value = command as { workflow?: unknown; prompt?: unknown };
    if (
      (value.workflow !== "brownfield-discovery" && value.workflow !== "architecture-documentation" && value.workflow !== "architecture-planning")
      || typeof value.prompt !== "string"
      || !value.prompt.trim()
    ) throw new Error("command workflow and non-empty prompt are required");
    await startChat();
    const runtime = await getAgentRuntime();
    const state = await runtime.start(
      { workflow: value.workflow, prompt: value.prompt.trim() },
      { projectId: projectName, threadId: `${projectName}/thread-main`, runId: randomUUID(), requestId: randomUUID() },
    );
    return { accepted: state.status !== "failed", requestId: state.ompRequestId ?? "" };
  });
  ipcMain.handle("studio:chat:stop", async () => {
    agentRuntime?.stop();
    agentRuntime = undefined;
    chatStart = undefined;
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
  agentRuntime?.stop();
  if (process.platform !== "darwin") app.quit();
});
