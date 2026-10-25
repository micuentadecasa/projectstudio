import { _electron as electron, type Page } from "playwright";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { brownfieldDomains, scenarios } from "./pdac-scenario-manifest.js";
import type { Scenario, ScenarioKind } from "./pdac-scenario-manifest.js";
type Result = { slug: string; kind: ScenarioKind; initialScreenshot: string; modificationScreenshot: string; artifactScreenshots: string[]; diagramEditScreenshot: string; modifiedTitle: string; checks: Record<string, boolean> };
type Graph = { schema: string; nodes: Array<Record<string, string>>; edges: Array<Record<string, string>> };

const root = resolve(import.meta.dirname, "../..");
const main = resolve(root, "apps/desktop/dist/main.js");
const matrixRoot = resolve(root, ".tmp/e2e-pdac-matrix-20");
const evidenceRoot = resolve(root, "docs/implementation/evidence/F07-pdac-matrix-20");
const registryPath = resolve(root, ".tmp/e2e-pdac-matrix-20-projects.json");
const e2eUserData = resolve(root, ".tmp/e2e-pdac-user-data");
const environment = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)), PROJECTSTUDIO_PROJECT_REGISTRY: registryPath };
const artifactLabels = ["Propósito", "Actores", "Casos de uso", "Dominio", "Journeys", "Reglas", "Requisitos", "Bounded contexts"];
const artifactText = { "Propósito": "ProductShape", "Actores": "Actores", "Casos de uso": "Casos de uso", "Dominio": "Dominio", "Journeys": "Journeys", "Reglas": "Reglas y restricciones", "Requisitos": "Requisitos", "Bounded contexts": "Bounded contexts" } as const;

const selectedScenarios = process.env.F07_SCENARIOS ? scenarios.slice(0, Number(process.env.F07_SCENARIOS)) : scenarios;

function projectId(projectPath: string): string { return createHash("sha256").update(resolve(projectPath)).digest("hex").slice(0, 16); }
function modifiedTitle(scenario: Scenario): string { return `Modificación ${scenario.slug}: confirmación humana`; }
function createGraph(scenario: Scenario): Graph {
  const domain = brownfieldDomains[scenario.index % brownfieldDomains.length] ?? "producto local";
  const specs: Array<[string, string, string, string]> = [
    ["ACTOR", "actor", `Persona usuaria de ${domain}`, "docs/product/model/actors/user.md"],
    ["SYSTEM", "actor", `Sistema de ${domain}`, "docs/product/model/actors/system.md"],
    ["UC", "use-case", `Gestionar ${domain}`, "docs/product/model/use-cases/manage.md"],
    ["JOURNEY", "journey", `Recorrido de ${domain}`, "docs/product/model/journeys/main.md"],
    ["DOMAIN", "domain-term", `Operación de ${domain}`, "docs/product/model/domain/operation.md"],
    ["RULE", "business-rule", "Requiere confirmación humana", "docs/product/model/business-rules/confirmation.md"],
    ["REQ", "requirement", "Conservar trazabilidad", "docs/product/model/requirements/traceability.md"],
    ["BC", "bounded-context", `Contexto ${domain}`, "docs/product/model/domain/bounded-contexts/core.md"],
  ];
  const nodes = specs.map(([id, type, title, path]) => ({ id: `${id}-${scenario.slug}`, type, title, status: "draft", path }));
  return {
    schema: "product-definition-as-code/graph/v1alpha1",
    nodes,
    edges: nodes.slice(1).map((node, index) => ({ from: nodes[0]?.id ?? "", kind: index % 2 === 0 ? "uses" : "depends-on", to: node.id })),
  };
}
type Registry = { version: 1; activeId: string; projects: Array<{ id: string; name: string; path: string; mode: ScenarioKind; archived: boolean; lastOpenedAt: string; detected: { productShape: boolean; architecture: boolean; empty: boolean } }> };
async function readRegistry(): Promise<Registry> {
  try {
    const value = JSON.parse(await readFile(registryPath, "utf8")) as Registry;
    if (value.version === 1 && Array.isArray(value.projects)) return value;
  } catch {
    // The desktop app creates the registry on first launch.
  }
  return { version: 1, activeId: "", projects: [] };
}
async function prepareScenario(scenario: Scenario): Promise<string> {
  const projectPath = resolve(matrixRoot, scenario.slug);
  await rm(projectPath, { recursive: true, force: true });
  await mkdir(projectPath, { recursive: true });
  if (scenario.kind === "brownfield") {
    await mkdir(resolve(projectPath, "src"), { recursive: true });
    await writeFile(resolve(projectPath, "README.md"), `# ${scenario.slug}\n\nProyecto temporal para validar PDAC.\n`, "utf8");
    await writeFile(resolve(projectPath, "src/domain.ts"), `export const scenario = ${JSON.stringify(scenario.slug)};\nexport function confirmOperation(): boolean { return true; }\n`, "utf8");
    await mkdir(resolve(projectPath, ".product/generated"), { recursive: true });
    const graph = createGraph(scenario);
    await writeFile(resolve(projectPath, ".product/generated/product-graph.json"), `${JSON.stringify(graph, null, 2)}\n`, "utf8");
    await writeFile(resolve(projectPath, ".product/generated/product-graph.mmd"), "flowchart LR\n  ACTOR --> UC\n", "utf8");
  }
  const registry = await readRegistry();
  const id = projectId(projectPath);
  const record = { id, name: scenario.slug, path: projectPath, mode: scenario.kind, archived: false, lastOpenedAt: new Date().toISOString(), detected: { productShape: false, architecture: false, empty: scenario.kind === "greenfield" } };
  registry.projects = registry.projects.filter((project) => project.id !== id);
  registry.projects.push(record);
  registry.activeId = id;
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}
`, "utf8");
  return projectPath;
}
async function cleanProjectArtifacts(projectPath: string): Promise<void> {
  const key = projectId(projectPath);
  await Promise.all([
    rm(resolve(root, ".tmp/project-analysis", `${key}.json`), { force: true }),
    rm(resolve(root, ".tmp/project-discovery", `${key}.json`), { force: true }),
  ]);
}
async function cleanRegistry(): Promise<void> {
  try {
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as { activeId: string; projects: Array<{ id: string; path: string }> };
    const paths = new Set(scenarios.map((scenario) => resolve(matrixRoot, scenario.slug)));
    registry.projects = registry.projects.filter((project) => !paths.has(resolve(project.path)));
    if (!registry.projects.some((project) => project.id === registry.activeId)) registry.activeId = registry.projects[0]?.id ?? "";
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  } catch {
    // Registry is optional in a clean checkout.
  }
}
async function waitForProject(page: Page, slug: string): Promise<void> {
  try {
    await page.waitForFunction((value) => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.includes(value) === true || document.body.innerText.includes(value), slug, { timeout: 30_000 });
  } catch (error) {
    console.error(`Project selector did not show ${slug}:`, (await page.locator("body").innerText()).slice(0, 2000));
    throw error;
  }
}
async function waitForOmp(page: Page, previousMessages: number): Promise<string> {
  await page.waitForFunction((count) => document.querySelectorAll(".message-row.omp").length > count, previousMessages, { timeout: 180_000 });
  await page.locator('[data-chat-status="settled"]').waitFor({ timeout: 180_000 });
  return page.locator(".message-row.omp").last().innerText();
}
async function sendOmp(page: Page, prompt: string): Promise<string> {
  const previousMessages = await page.locator(".message-row.omp").count();
  await page.getByLabel("Mensaje para OMP").fill(prompt);
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  return waitForOmp(page, previousMessages);
}
async function capture(page: Page, name: string): Promise<string> {
  const relative = `docs/implementation/evidence/F07-pdac-matrix-20/${name}.png`;
  await page.screenshot({ path: resolve(root, relative), fullPage: false });
  return relative;
}
async function visitArtifacts(page: Page, scenario: Scenario): Promise<string[]> {
  const screenshots: string[] = [];
  for (const label of artifactLabels) {
    const button = page.getByRole("button", { name: label, exact: true });
    await button.click();
    await page.locator(".pdac-tldraw-stage").waitFor({ timeout: 30_000 });
    const shapeLocator = page.locator('.pdac-tldraw-stage .tl-shape[data-shape-id^="shape:"], .pdac-tldraw-stage .pdac-canvas-fallback-shape').first();
    try {
      await shapeLocator.waitFor({ timeout: 15_000 });
    } catch (error) {
      const canvas = page.locator('[data-testid="pdac-tldraw-canvas"]').first();
      const stage = page.locator(".pdac-tldraw-stage").first();
      const shapeCount = await page.locator('.pdac-tldraw-stage .tl-shape[data-shape-id^="shape:"]').count();
      const tldrawCount = await page.locator(".pdac-tldraw-stage .tl-container").count();
      const tldrawShapeAttributes = await page.locator(".pdac-tldraw-stage [data-shape-id]").evaluateAll((elements) => elements.slice(0, 8).map((element) => ({ tag: element.tagName, id: element.getAttribute("data-shape-id"), className: element.getAttribute("class") })));
      const stageMetrics = await stage.evaluate((element) => ({ rect: element.getBoundingClientRect().toJSON(), html: element.innerHTML.slice(0, 1200) }));
      const canvasStatus = await stage.getAttribute("data-canvas-status");
      const canvasShapeCount = await stage.getAttribute("data-shape-count");
      const canvasProject = await canvas.getAttribute("data-pdac-project");
      throw new Error(`${scenario.slug}: el lienzo quedó vacío al terminar OMP en ${label}; shapes=${shapeCount}, tldraw=${tldrawCount}, canvasStatus=${canvasStatus}, canvasShapeCount=${canvasShapeCount}, canvasProject=${canvasProject}, shapeAttrs=${JSON.stringify(tldrawShapeAttributes)}, stage=${JSON.stringify(stageMetrics)}`, { cause: error });
    }
    const pageText = await page.locator(".pdac-workbench").innerText();
    const focusVisible = label === "Propósito" ? await page.locator(".overview-screen").count() === 1 : pageText.includes(artifactText[label as keyof typeof artifactText]);
    if (!focusVisible) throw new Error(`${scenario.slug}: el centro no muestra el foco ${label}; texto=${pageText.slice(0, 400)}`);
    screenshots.push(await capture(page, `${scenario.slug}-artifact-${label.toLowerCase().replace(/[^a-záéíóúñ]+/gi, "-")}`));
  }
  return screenshots;
}
async function editDiagramAndVerifyGraph(page: Page, projectPath: string, scenario: Scenario): Promise<{ screenshot: string; graphUpdated: boolean }> {
  await page.getByRole("button", { name: "Casos de uso", exact: true }).click();
  const stage = page.locator(".pdac-tldraw-stage");
  await stage.waitFor({ timeout: 30_000 });
  const shape = stage.locator('.tl-shape[data-shape-id^="shape:"], .pdac-canvas-fallback-shape').first();
  await shape.waitFor({ timeout: 30_000 });
  const editedTitle = `Lienzo editado · ${scenario.slug}`;
  await shape.dblclick();
  const textEditor = page.locator('[contenteditable="true"]').last();
  await textEditor.waitFor({ timeout: 5_000 });
  await textEditor.click();
  await page.keyboard.press("Meta+A");
  await page.keyboard.type(editedTitle);
  await page.keyboard.press("Tab");
  const graphPath = resolve(projectPath, ".product", "generated", "product-graph.json");
  let graphUpdated = false;
  let titles: string[] = [];
  for (let attempt = 0; attempt < 40 && !graphUpdated; attempt += 1) {
    try {
      const graph = JSON.parse(await readFile(graphPath, "utf8")) as Graph;
      titles = graph.nodes.map((node) => node.title).filter((title): title is string => typeof title === "string");
      graphUpdated = titles.includes(editedTitle);
    } catch {
      titles = [];
    }
    if (!graphUpdated) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!graphUpdated) throw new Error(`${scenario.slug}: la edición del lienzo no actualizó product-graph.json; títulos=${titles.join(" | ")}`);
  return { screenshot: await capture(page, `${scenario.slug}-artifact-editado`), graphUpdated };
}
async function openApp(projectPath: string, withRoot: boolean): Promise<{ app: Awaited<ReturnType<typeof electron.launch>>; page: Page }> {
  const app = await electron.launch({ args: [`--user-data-dir=${e2eUserData}`, main], cwd: root, env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1", ...(withRoot ? { PROJECTSTUDIO_PROJECT_ROOT: projectPath } : {}) } });
  app.process().stderr?.on("data", (chunk) => { if (process.env.F07_VERBOSE === "1") console.error(`[electron:${projectPath}] ${chunk.toString("utf8")}`); });
  const page = await app.firstWindow();
  page.on("pageerror", (error) => { if (process.env.F07_VERBOSE === "1") console.error(`[renderer:${projectPath}]`, error); });
  page.on("console", (message) => { if (process.env.F07_VERBOSE === "1" && message.type() === "error") console.error(`[console:${projectPath}] ${message.text()}`); });
  return { app, page };
}
async function runScenario(scenario: Scenario): Promise<Result> {
  const projectPath = await prepareScenario(scenario);
  let first: Awaited<ReturnType<typeof electron.launch>> | undefined;
  let second: Awaited<ReturnType<typeof electron.launch>> | undefined;
  try {
    const opened = await openApp(projectPath, true);
    first = opened.app;
    const page = opened.page;
    await waitForProject(page, scenario.slug);
    await page.getByTitle("Producto y casos de uso").click();
    await page.locator(".pdac-workbench").waitFor({ timeout: 30_000 });
    if (scenario.kind === "greenfield") await page.waitForFunction(() => document.body.innerText.includes("primer caso de uso"), undefined, { timeout: 30_000 });
    const initialResponse = await sendOmp(page, scenario.prompt);
    if (!/actor|caso de uso|resultado|incógnita|hallazgo/i.test(initialResponse)) throw new Error(`${scenario.slug}: OMP no produjo evidencia PDAC inicial`);
    const initialScreenshot = await capture(page, `${scenario.slug}-omp-01-inicial`);
    await first.close();
    first = undefined;

    if (scenario.kind === "brownfield") {
      const graphPath = resolve(projectPath, ".product/generated/product-graph.json");
      const graph = JSON.parse(await readFile(graphPath, "utf8")) as Graph;
      graph.nodes.push({ id: `MOD-${scenario.slug}`, type: "use-case", title: modifiedTitle(scenario), status: "draft", path: "docs/product/model/use-cases/modified.md" });
      graph.edges.push({ from: `ACTOR-${scenario.slug}`, kind: "confirms", to: `MOD-${scenario.slug}` });
      await writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
    }

    const reopened = await openApp(projectPath, false);
    second = reopened.app;
    const reopenedPage = reopened.page;
    await waitForProject(reopenedPage, scenario.slug);
    await reopenedPage.getByTitle("Producto y casos de uso").click();
    await reopenedPage.locator(".pdac-workbench").waitFor({ timeout: 30_000 });
    const modificationResponse = await sendOmp(reopenedPage, scenario.modification);
    if (!/actor|caso de uso|resultado|incógnita|regla|confirm/i.test(modificationResponse)) throw new Error(`${scenario.slug}: OMP no produjo respuesta de modificación`);
    const modificationScreenshot = await capture(reopenedPage, `${scenario.slug}-omp-02-modificacion`);
    const artifactScreenshots = await visitArtifacts(reopenedPage, scenario);
    const diagramEdit = await editDiagramAndVerifyGraph(reopenedPage, projectPath, scenario);
    await reopenedPage.getByRole("button", { name: "Bounded contexts", exact: true }).click();
    await reopenedPage.locator(".contexts-screen").waitFor({ timeout: 30_000 });
    await reopenedPage.waitForTimeout(300);
    await second?.close();
    second = undefined;

    const final = await openApp(projectPath, false);
    second = final.app;
    const finalPage = final.page;
    await waitForProject(finalPage, scenario.slug);
    await finalPage.locator(".contexts-screen").waitFor({ timeout: 30_000 });
    const checks = {
      projectRestored: (await finalPage.locator(".project-picker select option:checked").innerText()).includes(scenario.slug),
      focusRestored: await finalPage.locator(".contexts-screen").count() === 1,
      allArtifactScreensCaptured: artifactScreenshots.length === artifactLabels.length,
      diagramEditPersisted: diagramEdit.graphUpdated,
      noInternalPrompt: !/Eres el agente operativo|Flujo autorizado|GREENFIELD:|brownfield-discovery/i.test(await finalPage.locator(".chat-messages").innerText()),
      singleStatus: await finalPage.locator(".chat-activity").count() === 0,
    };
    if (Object.values(checks).some((value) => !value)) throw new Error(`${scenario.slug}: checks failed ${JSON.stringify(checks)}`);
    return { slug: scenario.slug, kind: scenario.kind, initialScreenshot, modificationScreenshot, artifactScreenshots, diagramEditScreenshot: diagramEdit.screenshot, modifiedTitle: modifiedTitle(scenario), checks };
  } finally {
    await first?.close();
    await second?.close();
    await rm(projectPath, { recursive: true, force: true });
    await cleanProjectArtifacts(projectPath);
  }
}

await rm(matrixRoot, { recursive: true, force: true });
await rm(evidenceRoot, { recursive: true, force: true });
await rm(e2eUserData, { recursive: true, force: true });
try {
  const results: Result[] = [];
  for (const scenario of selectedScenarios) results.push(await runScenario(scenario));
  await cleanRegistry();
  const report = { mode: "real-omp", scenarios: results, scenarioCount: results.length, artifactCountPerScenario: artifactLabels.length, repositoriesModified: false };
  await writeFile(resolve(evidenceRoot, "F07-T01-matrix-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(matrixRoot, { recursive: true, force: true });
  await cleanRegistry();
}
