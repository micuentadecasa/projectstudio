import { _electron as electron } from "playwright";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const notesRoot = process.env.PROJECTSTUDIO_NOTES_ROOT ?? "/Users/luis/projects/notes";
const fixtureRoot = resolve(root, ".tmp/e2e-notes-pdac-lifecycle");
const graphSource = resolve(notesRoot, ".product/generated/product-graph.json");
const mermaidSource = resolve(notesRoot, ".product/generated/product-graph.mmd");
const registryPath = resolve(root, ".tmp/projectstudio-projects.json");
const main = resolve(root, "apps/desktop/dist/main.js");
const evidencePath = resolve(root, "docs/implementation/evidence/F06-T17-notes-pdac-reload.png");
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

function projectId(projectPath: string): string {
  return createHash("sha256").update(resolve(projectPath)).digest("hex").slice(0, 16);
}

async function cleanRegistry(): Promise<void> {
  try {
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as { activeId: string; projects: Array<{ id: string; path: string }> };
    registry.projects = registry.projects.filter((project) => resolve(project.path) !== fixtureRoot);
    if (!registry.projects.some((project) => project.id === registry.activeId)) registry.activeId = registry.projects[0]?.id ?? "";
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  } catch {
    // The registry is optional during a first run.
  }
}
async function registerFixture(): Promise<void> {
  const registry = JSON.parse(await readFile(registryPath, "utf8")) as { activeId: string; projects: Array<Record<string, unknown>>; version?: number };
  const id = projectId(fixtureRoot);
  registry.projects = registry.projects.filter((project) => resolve(String(project.path ?? "")) !== fixtureRoot);
  registry.projects.push({
    id,
    name: "e2e-notes-pdac-lifecycle",
    path: fixtureRoot,
    archived: false,
    lastOpenedAt: new Date().toISOString(),
    detected: { productShape: true, architecture: false, empty: false },
    mode: "brownfield",
  });
  registry.activeId = id;
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}


async function openProductShape(expectLoaded = true) {
  const app = await electron.launch({
    args: [main],
    cwd: root,
    env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1", PROJECTSTUDIO_PROJECT_ROOT: fixtureRoot },
  });
  const window = await app.firstWindow();
  await window.waitForFunction(() => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.includes("e2e-notes-pdac-lifecycle"), undefined, { timeout: 30_000 });
  await window.getByTitle("Producto y casos de uso").click();
  if (expectLoaded) await window.getByText(/He cargado \d+ elementos del PDAC que vive en el proyecto/).waitFor({ timeout: 30_000 });
  else await window.locator(".pdac-artifact-nav").waitFor({ timeout: 30_000 });
  return { app, window };
}

await rm(fixtureRoot, { recursive: true, force: true });
await mkdir(join(fixtureRoot, ".product/generated"), { recursive: true });
await writeFile(join(fixtureRoot, "README.md"), "Fixture segura: sólo se prueba la recuperación del PDAC.\n", "utf8");
await writeFile(join(fixtureRoot, ".product/generated/product-graph.json"), await readFile(graphSource, "utf8"), "utf8");
await writeFile(join(fixtureRoot, ".product/generated/product-graph.mmd"), await readFile(mermaidSource, "utf8"), "utf8");
await registerFixture();
try {
  const first = await openProductShape();
  try {
    if (!(await first.window.locator(".pdac-details-card").innerText()).includes("MuScriptor")) throw new Error("Initial PDAC truth did not expose the Notes graph");
  } finally {
    await first.app.close();
  }

  const graphPath = join(fixtureRoot, ".product/generated/product-graph.json");
  const graph = JSON.parse(await readFile(graphPath, "utf8")) as { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
  graph.nodes.unshift({ id: "UC-PDAC-RELOAD", type: "use-case", title: "Confirm PDAC recovery after reopening", status: "draft", path: "docs/product/model/use-cases/uc-pdac-reload.md" });
  graph.edges.push({ from: "UC-PDAC-RELOAD", kind: "confirms", to: "ACT-LEARNER" });
  await writeFile(graphPath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");

  const second = await openProductShape();
  try {
    await second.window.locator(".pdac-details-card").getByText(/Confirm PDAC recovery after reopening/).waitFor({ timeout: 30_000 });
    for (const artifact of [/Casos de uso/, /Actores/, /Dominio/, /Journeys/]) {
      await second.window.getByRole("button", { name: artifact }).click();
      await second.window.locator(".pdac-tldraw-stage").waitFor();
    }
    await second.window.screenshot({ path: evidencePath, fullPage: false });
  } finally {
    await second.app.close();
  }

  await rm(join(fixtureRoot, ".product/generated"), { recursive: true, force: true });
  const reset = await openProductShape(false);
  if (reset) {
    try {
      if (await reset.window.getByText(/He cargado \d+ elementos del PDAC que vive en el proyecto/).count() !== 0) throw new Error("PDAC recovery survived after deleting the source graph");
    } finally {
      await reset.app.close();
    }
  }
  console.log(JSON.stringify({ mode: "local-persistence", sourceProject: notesRoot, fixtureDeleted: true, fixtureProjectId: projectId(fixtureRoot), screenshot: "docs/implementation/evidence/F06-T17-notes-pdac-reload.png" }, null, 2));
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  await cleanRegistry();
}
