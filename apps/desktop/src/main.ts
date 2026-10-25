import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
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
type ProjectMode = "brownfield" | "greenfield";
type ProjectRecord = {
  id: string;
  name: string;
  path: string;
  mode: ProjectMode;
  archived: boolean;
  lastOpenedAt: string;
  detected: { productShape: boolean; architecture: boolean; empty: boolean };
};
const pdacStructuredPrompt = 'Devuelve además un bloque ```json con {"pdac":[{"type":"actor|use-case|domain-term|journey|business-rule|requirement|constraint|bounded-context","title":"...","detail":"...","evidence":"ruta:líneas","confidence":"high|medium|low"}]} para cada entidad respaldada. Si no existe una entidad, no la inventes.';
type ProjectRegistry = { version: 1; activeId: string; projects: ProjectRecord[] };

function projectRegistryPath(): string {
  const configuredPath = process.env.PROJECTSTUDIO_PROJECT_REGISTRY;
  const path = configuredPath ? resolve(configuredPath) : join(workspaceRoot, ".tmp", "projectstudio-projects.json");
  mkdirSync(dirname(path), { recursive: true });
  return path;
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
  const visibleEntries = rootEntries.filter((entry) => !entry.startsWith(".") && entry !== "node_modules");
  return {
    productShape: (await exists("docs/product")) || (await exists("productshape")) || rootEntries.some((entry) => entry.toLowerCase().includes("productshape")),
    architecture: (await exists("docs/architecture")) || (await exists("architecture")) || (await exists("docs/adr")) || rootEntries.some((entry) => entry.toLowerCase().includes("architecture")),
    empty: visibleEntries.length === 0,
  };
}
function projectMode(detected: ProjectRecord["detected"]): ProjectMode {
  return detected.empty ? "greenfield" : "brownfield";
}

async function readProjectRegistry(): Promise<ProjectRegistry> {
  try {
    const value = JSON.parse(await readFile(projectRegistryPath(), "utf8")) as ProjectRegistry;
    if (value.version === 1 && Array.isArray(value.projects)) {
      if (!process.env.PROJECTSTUDIO_PROJECT_ROOT) {
        const persisted = value.projects.find((project) => project.id === value.activeId && !project.archived);
        if (persisted) {
          projectRoot = resolve(persisted.path);
          projectName = persisted.name;
        }
      }
      const currentId = createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
      if (!value.projects.some((project) => project.id === currentId)) {
        const detected = await detectProjectSignals(projectRoot);
        value.projects.push({ id: currentId, name: projectName, path: projectRoot, mode: projectMode(detected), archived: false, lastOpenedAt: new Date().toISOString(), detected });
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
    projects: [{ id: createHash("sha256").update(projectRoot).digest("hex").slice(0, 16), name: projectName, path: projectRoot, mode: projectMode(detected), archived: false, lastOpenedAt: new Date().toISOString(), detected }],
  };
}

async function writeProjectRegistry(registry: ProjectRegistry): Promise<void> {
  await writeFile(projectRegistryPath(), `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

async function listProjects(): Promise<ProjectRegistry> {
  const registry = await readProjectRegistry();
  for (const project of registry.projects) {
    project.detected = await detectProjectSignals(project.path);
    project.mode = projectMode(project.detected);
  }
  await writeProjectRegistry(registry);
  return registry;
}

async function activateProject(path: string): Promise<ProjectRegistry> {
  const resolvedPath = resolve(path);
  await stat(resolvedPath);
  const registry = await readProjectRegistry();
  const id = createHash("sha256").update(resolvedPath).digest("hex").slice(0, 16);
  const existing = registry.projects.find((project) => project.id === id);
  const detected = await detectProjectSignals(resolvedPath);
  const record = existing ?? { id, name: basename(resolvedPath), path: resolvedPath, mode: projectMode(detected), archived: false, lastOpenedAt: new Date().toISOString(), detected };
  record.archived = false;
  record.lastOpenedAt = new Date().toISOString();
  record.detected = detected;
  record.mode = projectMode(detected);
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
type ProjectPdacNode = { id?: string; type?: string; title?: string; status?: string; path?: string };
type ProjectPdacEdge = { from?: string; to?: string; kind?: string };
type ProjectPdacArtifact = { id: string; type: string; title: string; status?: string; path?: string; steps?: string[] };
type ProjectPdacTruth = { report: string; mermaid: string | null; updatedAt: string; artifacts: ProjectPdacArtifact[] };
type PdacCandidateInput = { type?: unknown; title?: unknown; detail?: unknown; evidence?: unknown; confidence?: unknown; primaryActor?: unknown; definedIn?: unknown };
type PdacCandidate = { type: "actor" | "use-case" | "domain-term" | "journey" | "business-rule" | "requirement" | "constraint" | "bounded-context"; title: string; detail: string; evidence?: string; confidence?: string; primaryActor?: string; definedIn?: string };
async function journeyStepTitles(node: ProjectPdacNode, graphNodes: Array<ProjectPdacNode & { id: string; title: string }>): Promise<string[]> {
  if (node.type !== "journey" || !node.path) return [];
  try {
    const content = await readFile(join(projectRoot, node.path), "utf8");
    const stepIds = [...content.matchAll(/^\s*-\s*use-case:\s*([A-Z0-9-]+)\s*$/gm)].map((match) => match[1]).filter((id): id is string => Boolean(id));
    const titles = new Map(graphNodes.map((candidate) => [candidate.id, candidate.title]));
    return stepIds.map((id) => titles.get(id) ?? id);
  } catch {
    return [];
  }
}

async function readProjectPdacTruth(): Promise<ProjectPdacTruth | null> {
  const graphPath = join(projectRoot, ".product", "generated", "product-graph.json");
  try {
    const graph = JSON.parse(await readFile(graphPath, "utf8")) as { nodes?: ProjectPdacNode[]; edges?: ProjectPdacEdge[] };
    const nodes = Array.isArray(graph.nodes) ? graph.nodes.filter((node) => typeof node.title === "string" && typeof node.path === "string" && !node.path.endsWith("/canvas.md")) : [];
    if (nodes.length === 0) return null;
    const grouped = new Map<string, ProjectPdacNode[]>();
    for (const node of nodes) {
      const type = node.type ?? "artifact";
      grouped.set(type, [...(grouped.get(type) ?? []), node]);
    }
    const typeLabels: Record<string, string> = {
      actor: "Actor",
      "use-case": "Caso de uso",
      journey: "Journey",
      "domain-term": "Término de dominio",
      "business-rule": "Regla de negocio",
      requirement: "Requisito",
      constraint: "Restricción",
      "bounded-context": "Bounded context",
      behaviour: "Comportamiento",
    };
    const report = [
      "# Estado PDAC actual",
      `Fuente de verdad: ${graphPath}`,
      `Nodos confirmados: ${nodes.length}. Relaciones confirmadas: ${Array.isArray(graph.edges) ? graph.edges.length : 0}.`,
      ...[...grouped.entries()].flatMap(([type, entries]) => entries.map((node) => `- ${typeLabels[type] ?? type}: ${node.title} · estado ${node.status ?? "sin estado"} · evidencia ${node.path ?? "sin ruta"}`)),
    ].join("\n");
    const graphNodes = nodes.filter((node): node is ProjectPdacNode & { id: string; title: string } => typeof node.id === "string" && typeof node.title === "string");
    const graphNodeIds = new Map(graphNodes.map((node, index) => [node.id, `N${index}`]));
    const graphMermaid = [
      "flowchart LR",
      ...graphNodes.map((node, index) => `N${index}["${`${typeLabels[node.type ?? "artifact"] ?? node.type ?? "Artefacto"} · ${node.title}`.replace(/["[\]`]/g, "")}"]`),
      ...(Array.isArray(graph.edges) ? graph.edges.flatMap((edge) => {
        const from = edge.from ? graphNodeIds.get(edge.from) : undefined;
        const to = edge.to ? graphNodeIds.get(edge.to) : undefined;
        return from && to ? [`${from} -->|${(edge.kind ?? "relación").replace(/["[\]`]/g, "")}| ${to}`] : [];
      }) : []),
    ].join("\n");
    let mermaid: string | null = graphMermaid === "flowchart LR" ? null : graphMermaid;
    if (!mermaid) {
      try {
        mermaid = (await readFile(join(projectRoot, ".product", "generated", "product-graph.mmd"), "utf8")).trim() || null;
      } catch {
        // The JSON graph remains sufficient to restore the PDAC inventory.
      }
    }
    const updatedAt = (await stat(graphPath)).mtime.toISOString();
    const artifacts = await Promise.all(graphNodes.map(async (node) => {
      const artifact: ProjectPdacArtifact = { id: node.id, type: node.type ?? "artifact", title: node.title };
      if (typeof node.status === "string") artifact.status = node.status;
      if (typeof node.path === "string") artifact.path = node.path;
      const steps = await journeyStepTitles(node, graphNodes);
      if (steps.length > 0) artifact.steps = steps;
      return artifact;
    }));
    return { report, mermaid, updatedAt, artifacts };
  } catch {
    return null;
  }
}
type ProductShapeGraphResult = { ok: boolean; output: string; error?: string };

function runProductShapeGraph(): Promise<ProductShapeGraphResult> {
  const configuredBinary = process.env.PRODUCTSHAPE_BIN;
  const binary = configuredBinary ?? "pnpm";
  const args = configuredBinary
    ? ["graph", "--format", "json"]
    : ["--package=@prodshape/cli@0.23.0", "dlx", "prodshape", "graph", "--format", "json"];
  return new Promise((resolveResult) => {
    const child = spawn(binary, args, { cwd: projectRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let errorOutput = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { errorOutput += chunk.toString(); });
    child.once("error", (error) => resolveResult({ ok: false, output, error: error.message }));
    child.once("close", (code) => {
      const combined = `${output}\n${errorOutput}`.trim();
      resolveResult(code === 0 ? { ok: true, output: combined } : { ok: false, output: combined, error: `ProductShape terminó con código ${code ?? "desconocido"}` });
    });
  });
}
const pdacCandidateDirectories: Record<PdacCandidate["type"], string> = {
  actor: "actors",
  "use-case": "use-cases",
  "domain-term": "domain/terms",
  journey: "journeys",
  "business-rule": "business-rules",
  requirement: "requirements/functional",
  constraint: "requirements/constraints",
  "bounded-context": "domain/bounded-contexts",
};
const pdacCandidatePrefixes: Record<PdacCandidate["type"], string> = {
  actor: "ACT",
  "use-case": "UC",
  "domain-term": "TERM",
  journey: "JRN",
  "business-rule": "BR",
  requirement: "FR",
  constraint: "CON",
  "bounded-context": "BC",
};
const pdacCandidateSchemaTypes: Record<PdacCandidate["type"], string> = {
  actor: "actor",
  "use-case": "use-case",
  "domain-term": "domain-term",
  journey: "journey",
  "business-rule": "business-rule",
  requirement: "functional-requirement",
  constraint: "constraint",
  "bounded-context": "bounded-context",
};
function slugifyPdac(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "hallazgo";
}
function normalizePdacCandidate(input: PdacCandidateInput): PdacCandidate | null {
  const type = input.type;
  const title = typeof input.title === "string" ? input.title.replace(/\s+/g, " ").trim() : "";
  if (!Object.hasOwn(pdacCandidateDirectories, type as string) || !title || title.length > 160) return null;
  const detail = typeof input.detail === "string" && input.detail.trim() ? input.detail.trim().slice(0, 2_000) : "Hallazgo propuesto por OMP a partir de la evidencia del proyecto.";
  const evidence = typeof input.evidence === "string" && input.evidence.trim() ? input.evidence.trim().slice(0, 240) : undefined;
  const confidence = typeof input.confidence === "string" && input.confidence.trim() ? input.confidence.trim().slice(0, 32) : "medium";
  const primaryActor = typeof input.primaryActor === "string" && /^ACT-[A-Z0-9-]+$/i.test(input.primaryActor.trim()) ? input.primaryActor.trim().toUpperCase() : undefined;
  const definedIn = typeof input.definedIn === "string" && /^BC-[A-Z0-9-]+$/i.test(input.definedIn.trim()) ? input.definedIn.trim().toUpperCase() : undefined;
  const candidate: PdacCandidate = { type: type as PdacCandidate["type"], title, detail, confidence };
  if (evidence) candidate.evidence = evidence;
  if (primaryActor) candidate.primaryActor = primaryActor;
  if (definedIn) candidate.definedIn = definedIn;
  return candidate;
}
function pdacId(candidate: PdacCandidate): string {
  return `${pdacCandidatePrefixes[candidate.type]}-${slugifyPdac(candidate.title).toUpperCase()}`;
}
function pdacDocument(candidate: PdacCandidate, journeyStepId: string, requirementSourceId: string): { id: string; path: string; content: string } {
  const id = pdacId(candidate);
  const directory = pdacCandidateDirectories[candidate.type];
  const path = join(projectRoot, "docs", "product", "model", directory, `${id.toLowerCase()}.md`);
  const source = (candidate.evidence ?? "OMP: evidencia pendiente de consolidación").replace(/[\r\n]+/g, " ").replace(/"/g, "'");
  const detail = candidate.detail.replace(/\r\n/g, "\n").trim();
  const actorKind = candidate.type === "actor" ? "actor-kind: human\n" : "";
  const relationshipFrontmatter = candidate.type === "use-case"
    ? [`primary-actor: ${candidate.primaryActor ?? "ACT-PRODUCT-USER"}`, "supporting-actors: []", "governed-by: []", "uses-terms: []"]
    : candidate.type === "journey"
      ? [`primary-actor: ${candidate.primaryActor ?? "ACT-PRODUCT-USER"}`, `steps:\n  - use-case: ${journeyStepId}`]
      : candidate.type === "domain-term"
        ? [`defined-in: ${candidate.definedIn ?? "BC-PRODUCT"}`, "synonyms: []", "uses-terms: []"]
        : candidate.type === "requirement"
          ? [`derived-from:\n  - ${requirementSourceId}`, "verification:\n  - scenario: \"La evidencia disponible permite comprobar el requisito en el código.\""]
          : [];
  const sections: Record<PdacCandidate["type"], string> = {
    actor: `## Purpose\n${detail}\n\n## Goals\n${detail}\n\n## Responsibilities\n${detail}\n\n## Boundaries\nPendiente de confirmar con nueva evidencia.`,
    "use-case": `## Goal\n${detail}\n\n## Trigger\nPendiente de confirmar con la evidencia disponible.\n\n## Preconditions\nPendiente de confirmar con la evidencia disponible.\n\n## Main Flow\n${detail}\n\n## Alternative Flows\nPendiente de confirmar.\n\n## Failure Conditions\nPendiente de confirmar.\n\n## Postconditions\n${detail}`,
    "domain-term": `## Definition\n${detail}\n\n## Distinguish From\nPendiente de confirmar.\n\n## Usage\n${detail}`,
    journey: `## Intended Outcome\n${detail}\n\n## Entry Conditions\nPendiente de confirmar.\n\n## Journey Narrative\n${detail}\n\n## Variants and Branches\nPendiente de confirmar.\n\n## Completion Conditions\n${detail}`,
    "business-rule": `## Rule\n${detail}\n\n## Rationale\nPendiente de confirmar.\n\n## Examples\n${detail}\n\n## Exceptions\nPendiente de confirmar.`,
    requirement: `## Requirement\n${detail}\n\n## Rationale\nPendiente de confirmar.`,
    constraint: `## Constraint\n${detail}\n\n## Rationale\nPendiente de confirmar.\n\n## Consequences\nPendiente de confirmar.`,
    "bounded-context": `## Responsibility\n${detail}\n\n## Language\nPendiente de confirmar.\n\n## Boundaries\n${detail}\n\n## External Relationships\nPendiente de confirmar.`,
  };
  const content = [
    "---",
    `id: ${id}`,
    `type: ${pdacCandidateSchemaTypes[candidate.type]}`,
    `title: ${candidate.title.replace(/[\r\n]+/g, " ").replace(/:/g, " - ")}`,
    "status: draft",
    actorKind.trimEnd(),
    ...relationshipFrontmatter,
    "provenance:",
    `  source: "${source}"`,
    `  confidence: ${candidate.confidence ?? "medium"}`,
    "  recovered-from: observation",
    "---",
    "",
    sections[candidate.type],
    "",
    "## Evidence",
    "",
    `- ${source}`,
    "",
  ].filter((line) => line.length > 0).join("\n");
  return { id, path, content };
}
async function promotePdacCandidates(inputs: PdacCandidateInput[]): Promise<{ ok: boolean; created: number; artifacts?: ProjectPdacArtifact[]; mermaid?: string | null; error?: string }> {
  const candidates = inputs.map(normalizePdacCandidate).filter((candidate): candidate is PdacCandidate => candidate !== null);
  const unique = [...new Map(candidates.map((candidate) => [`${candidate.type}:${slugifyPdac(candidate.title)}`, candidate])).values()];
  const needsFallbackActor = unique.some((candidate) => candidate.type === "use-case" && !candidate.primaryActor);
  const needsFallbackContext = unique.some((candidate) => candidate.type === "domain-term" && !candidate.definedIn);
  const needsFallbackUseCase = unique.some((candidate) => candidate.type === "journey" || candidate.type === "requirement") && !unique.some((candidate) => candidate.type === "use-case");
  if (needsFallbackActor) {
    unique.push({ type: "actor", title: "Product user", detail: "Actor provisional usado para mantener la trazabilidad de casos de uso durante la recuperación autónoma.", confidence: "medium" });
    for (const candidate of unique) if (candidate.type === "use-case" && !candidate.primaryActor) candidate.primaryActor = "ACT-PRODUCT-USER";
  }
  if (needsFallbackContext) {
    unique.push({ type: "bounded-context", title: "Product domain", detail: "Contexto provisional para agrupar términos recuperados mientras se completa la delimitación del dominio.", confidence: "medium" });
    for (const candidate of unique) if (candidate.type === "domain-term" && !candidate.definedIn) candidate.definedIn = "BC-PRODUCT-DOMAIN";
  }
  if (needsFallbackUseCase) {
    unique.push({ type: "use-case", title: "Recovered PDAC journey step", detail: "Paso provisional para mantener una referencia ProductShape válida durante la recuperación.", confidence: "medium", primaryActor: "ACT-PRODUCT-USER" });
  }
  if (unique.length === 0) return { ok: true, created: 0, artifacts: [], mermaid: null };
  const journeyStepId = pdacId(unique.find((candidate) => candidate.type === "use-case") ?? { type: "use-case", title: "Recovered PDAC journey step", detail: "", confidence: "medium" });
  const requirementSourceId = pdacId(unique.find((candidate) => candidate.type === "use-case" || candidate.type === "business-rule" || candidate.type === "constraint") ?? { type: "use-case", title: "Recovered PDAC journey step", detail: "", confidence: "medium" });
  let created = 0;
  for (const candidate of unique) {
    const document = pdacDocument(candidate, journeyStepId, requirementSourceId);
    await mkdir(dirname(document.path), { recursive: true });
    let previous = "";
    try {
      previous = await readFile(document.path, "utf8");
    } catch {
      // First draft for this candidate.
    }
    if (!/status:\s*(?:accepted|approved)/i.test(previous)) {
      await writeFile(document.path, document.content, "utf8");
      created += 1;
    }
  }
  const result = await runProductShapeGraph();
  if (!result.ok) return { ok: false, created, error: result.error ?? "ProductShape no pudo validar los drafts PDAC." };
  const truth = await readProjectPdacTruth();
  if (!truth) return { ok: false, created, error: "ProductShape no devolvió nodos después de promover los drafts." };
  return { ok: true, created, artifacts: truth.artifacts, mermaid: truth.mermaid };
}
type PdacCanvasEdit = { nodeId?: string; page?: string; title?: string };
let pdacEditQueue = Promise.resolve();
async function writePdacCanvasEdit(input: PdacCanvasEdit): Promise<{ nodeId: string; title: string; updatedAt: string }> {
  const title = input.title?.replace(/\s+/g, " ").trim();
  const page = input.page?.trim();
  if (!title || !page || title.length > 160) throw new Error("invalid PDAC canvas edit");
  const graphPath = join(projectRoot, ".product", "generated", "product-graph.json");
  mkdirSync(dirname(graphPath), { recursive: true });
  let graph: { schema?: string; nodes?: ProjectPdacNode[]; edges?: ProjectPdacEdge[] };
  try {
    graph = JSON.parse(await readFile(graphPath, "utf8")) as typeof graph;
  } catch {
    graph = { schema: "product-definition-as-code/graph/v1alpha1", nodes: [], edges: [] };
  }
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodeId = input.nodeId?.trim() || `canvas-${page}-${createHash("sha256").update(title).digest("hex").slice(0, 12)}`;
  const type = page === "actors" ? "actor" : page === "use-cases" ? "use-case" : page === "domains" ? "domain-term" : page === "journeys" ? "journey" : page === "rules" ? "business-rule" : page === "requirements" ? "requirement" : page === "contexts" ? "bounded-context" : "artifact";
  const existing = nodes.find((node) => node.id === nodeId);
  if (existing) {
    existing.title = title;
    existing.type ??= type;
    existing.status ??= "draft";
  } else {
    nodes.push({ id: nodeId, type, title, status: "draft", path: `docs/product/model/${page}/canvas.md` });
  }
  const temporaryPath = `${graphPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ ...graph, schema: graph.schema ?? "product-definition-as-code/graph/v1alpha1", nodes, edges: Array.isArray(graph.edges) ? graph.edges : [] }, null, 2)}\n`, "utf8");
  await rename(temporaryPath, graphPath);
  return { nodeId, title, updatedAt: (await stat(graphPath)).mtime.toISOString() };
}
function savePdacCanvasEdit(input: PdacCanvasEdit): Promise<{ nodeId: string; title: string; updatedAt: string }> {
  const result = pdacEditQueue.then(() => writePdacCanvasEdit(input));
  pdacEditQueue = result.then(() => undefined, () => undefined);
  return result;
}
async function loadStoredAnalysis(): Promise<{ projectName: string; mermaid: string | null; report: string | null; artifacts?: ProjectPdacArtifact[]; updatedAt?: string; stale?: boolean; source: "project-pdac" | "stored-analysis" | "none" }> {
  const signature = await projectContentSignature();
  const projectPdac = await readProjectPdacTruth();
  if (projectPdac) {
    return { projectName, mermaid: projectPdac.mermaid, report: projectPdac.report, artifacts: projectPdac.artifacts, updatedAt: projectPdac.updatedAt, stale: false, source: "project-pdac" };
  }
  try {
    const saved = JSON.parse(await readFile(projectAnalysisPath(), "utf8")) as StoredProjectAnalysis;
    return { projectName: saved.projectName, mermaid: saved.mermaid, report: saved.report, updatedAt: saved.updatedAt, stale: saved.sourceSignature !== signature, source: "stored-analysis" };
  } catch {
    // No hay análisis local guardado; el grafo ProductShape sigue siendo la autoridad.
  }
  return { projectName, mermaid: null, report: null, stale: false, source: "none" };
}
type StoredProjectAnalysis = { projectName: string; mermaid: string | null; report: string | null; updatedAt: string; sourceSignature: string };
function projectAnalysisPath(): string {
  const projectKey = createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
  const directory = join(workspaceRoot, ".tmp", "project-analysis");
  mkdirSync(directory, { recursive: true });
  return join(directory, `${projectKey}.json`);
}
async function projectContentSignature(): Promise<string> {
  const candidates = ["docs/product", "productshape", "docs/architecture", "architecture", ".product/generated/product-graph.json", ".product/generated/product-graph.mmd"];
  const entries: string[] = [];
  for (const candidate of candidates) {
    try {
      const details = await stat(join(projectRoot, candidate));
      entries.push(`${candidate}:${details.mtimeMs}:${details.size}`);
    } catch {
      entries.push(`${candidate}:missing`);
    }
  }
  return createHash("sha256").update(entries.join("|")).digest("hex");
}
async function saveStoredAnalysis(input: { report?: string | null; mermaid?: string | null }): Promise<StoredProjectAnalysis> {
  const signature = await projectContentSignature();
  let previous: StoredProjectAnalysis | null = null;
  try {
    previous = JSON.parse(await readFile(projectAnalysisPath(), "utf8")) as StoredProjectAnalysis;
  } catch {
    // First persisted result for this project.
  }
  const report = input.report?.trim() || null;
  const mergedReport = report && previous?.report ? `${previous.report}\n\n---\n\n${report}` : report ?? previous?.report ?? null;
  const saved: StoredProjectAnalysis = {
    projectName,
    mermaid: input.mermaid?.trim() || previous?.mermaid || null,
    report: mergedReport,
    updatedAt: new Date().toISOString(),
    sourceSignature: signature,
  };
  await writeFile(projectAnalysisPath(), `${JSON.stringify(saved, null, 2)}\n`, "utf8");
  return saved;
}
type DiscoveryStatus = "running" | "completed" | "failed" | "greenfield";
type DiscoveryMarker = { projectRoot: string; status: Exclude<DiscoveryStatus, "greenfield">; updatedAt: string };

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

async function writeDiscoveryMarker(status: Exclude<DiscoveryStatus, "greenfield">): Promise<void> {
  const marker: DiscoveryMarker = { projectRoot, status, updatedAt: new Date().toISOString() };
  await writeFile(discoveryMarkerPath(), `${JSON.stringify(marker)}\n`, "utf8");
}

async function bootstrapDiscovery(resume: boolean): Promise<{ status: DiscoveryStatus | "stored-artifact"; started: boolean; canResume?: boolean }> {
  if (process.env.PROJECTSTUDIO_SKIP_BOOTSTRAP === "1") return { status: "completed", started: false };
  const detected = await detectProjectSignals(projectRoot);
  if (detected.empty) return { status: "greenfield", started: false };
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
        prompt: `Inicia el descubrimiento del proyecto sin esperar otra instrucción. Lee la documentación de producto y después el código. Publica inventario, hechos, inferencias, incógnitas y un primer diagrama Mermaid confirmado. No modifiques archivos. ${pdacStructuredPrompt}`,
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
  ipcMain.handle("studio:project:productshape-graph", async () => {
    const result = await runProductShapeGraph();
    if (!result.ok) return { ok: false, error: result.error ?? "ProductShape no pudo compilar el grafo." };
    const truth = await readProjectPdacTruth();
    if (!truth) {
      await rm(join(projectRoot, ".product", "generated"), { recursive: true, force: true });
      return { ok: false, error: "ProductShape devolvió un grafo vacío; se necesita una revisión de OMP para recuperar evidencia." };
    }
    return { ok: true, artifacts: truth.artifacts, mermaid: truth.mermaid };
  });
  ipcMain.handle("studio:project:pdac-promote", async (_event, value: unknown) => {
    if (!Array.isArray(value)) throw new Error("PDAC candidates must be an array");
    return promotePdacCandidates(value as PdacCandidateInput[]);
  });
  ipcMain.handle("studio:project:recovery-policy", () => ({
    autonomous: process.env.PROJECTSTUDIO_AUTONOMOUS_RECOVERY === "1",
  }));
  ipcMain.handle("studio:project:analysis:save", async (_event, value: unknown) => {
    if (typeof value !== "object" || value === null) throw new Error("analysis must be an object");
    const input = value as { report?: unknown; mermaid?: unknown };
    return saveStoredAnalysis({
      report: typeof input.report === "string" ? input.report : null,
      mermaid: typeof input.mermaid === "string" ? input.mermaid : null,
    });
  });
  ipcMain.handle("studio:project:pdac-edit", async (_event, value: unknown) => {
    if (typeof value !== "object" || value === null) throw new Error("PDAC edit must be an object");
    const input = value as { nodeId?: unknown; page?: unknown; title?: unknown };
    const edit: PdacCanvasEdit = {};
    if (typeof input.nodeId === "string") edit.nodeId = input.nodeId;
    if (typeof input.page === "string") edit.page = input.page;
    if (typeof input.title === "string") edit.title = input.title;
    return savePdacCanvasEdit(edit);
  });
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
    const detected = await detectProjectSignals(projectRoot);
    const prompt = detected.empty
      ? [
        "GREENFIELD PDAC: actúa como facilitador de diseño de producto para un proyecto nuevo y vacío.",
        "No inspecciones código inexistente ni inventes arquitectura. Entrevista al usuario para construir un borrador PDAC.",
        "Pregunta de una en una; prioriza objetivo del caso de uso, actor principal, disparador, resultado esperado, excepciones, reglas y qué queda fuera.",
        "Después de cada respuesta, resume lo confirmado, separa incógnitas y formula sólo la siguiente pregunta más útil.",
        "Cuando haya suficiente claridad, propone un borrador PDAC con actores, casos de uso, reglas, dominios/bounded contexts y un Mermaid de producto. Pide confirmación antes de tratarlo como aceptado.",
        `Aporte del usuario: ${value.prompt.trim()}`,
      ].join("\n")
      : value.prompt.trim();
    const state = await runtime.start(
      { workflow: value.workflow, prompt },
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
