import { _electron as electron } from "playwright";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const notesRoot = process.env.PROJECTSTUDIO_NOTES_ROOT ?? "/Users/luis/projects/notes";
const testProjectRoot = resolve(root, ".tmp/e2e-notes-empty");
const testRegistryPath = resolve(root, ".tmp/e2e-notes-empty-registry.json");
await rm(testProjectRoot, { recursive: true, force: true });
await rm(testRegistryPath, { force: true });
await cp(notesRoot, testProjectRoot, { recursive: true });
await rm(resolve(testProjectRoot, "docs/product"), { recursive: true, force: true });
await rm(resolve(testProjectRoot, ".product"), { recursive: true, force: true });
const main = resolve(root, "apps/desktop/dist/main.js");
const evidenceDirectory = resolve(root, "docs/implementation/evidence");
await mkdir(evidenceDirectory, { recursive: true });
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const app = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: testProjectRoot, PROJECTSTUDIO_PROJECT_REGISTRY: testRegistryPath, PROJECTSTUDIO_AUTONOMOUS_RECOVERY: "1", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1" },
});
try {
  const window = await app.firstWindow();
  await window.waitForFunction(() => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.startsWith("e2e-notes-empty"), undefined, { timeout: 30_000 });
  const selectedProject = await window.locator(".project-picker select option:checked").innerText();
  if (!selectedProject.startsWith("e2e-notes-empty")) throw new Error(`unexpected project label: ${selectedProject}`);
  await window.locator('[data-chat-status="settled"], [data-chat-status="ready"]').waitFor({ timeout: 180_000 });
  await window.getByTitle("Producto y casos de uso").click();
  await window.locator(".pdac-artifact-nav").waitFor();
  const productShapeCount = await window.locator(".message-row.omp").count();
  await window.getByRole("button", { name: "Revisar", exact: true }).click();
  if (await window.locator(".message-row.user").filter({ hasText: "PRODUCTSHAPE:" }).count() !== 0) throw new Error("ProductShape internal action prompt leaked into chat");
  const productShapeMessage = window.locator(".message-row.omp").nth(productShapeCount);
  if (await window.locator(".pdac-activity-line").count() > 0) {
    if (await window.locator(".pdac-activity-line").count() !== 1 || await window.locator(".pdac-live-progress").count() !== 0) throw new Error("ProductShape exposes duplicate central activity status");
  }
  await window.waitForFunction((count) => document.querySelectorAll(".message-row.omp").length > count, productShapeCount, { timeout: 180_000 });
  await productShapeMessage.waitFor({ timeout: 180_000 });
  await window.locator('[data-chat-status="settled"]').waitFor({ timeout: 180_000 });
  await window.waitForFunction(async () => {
    const studio = (globalThis as unknown as { studio: { project: { productshapeGraph: () => Promise<{ artifacts?: Array<{ path?: string }> }> } } }).studio;
    const graph = await studio.project.productshapeGraph();
    return (graph.artifacts ?? []).some((artifact) => artifact.path?.startsWith("docs/product/model/"));
  }, undefined, { timeout: 180_000 });
  let canonicalNodes: Array<{ type?: string; title?: string; path?: string }> = [];
  try {
    const graph = JSON.parse(await readFile(resolve(testProjectRoot, ".product/generated/product-graph.json"), "utf8")) as { nodes?: Array<{ type?: string; title?: string; path?: string }> };
    canonicalNodes = graph.nodes?.filter((node) => node.path?.startsWith("docs/product/model/") && !node.path.endsWith("/canvas.md")) ?? [];
  } catch {
    // Keep the renderer diagnostics when promotion did not create a graph.
  }
  if (canonicalNodes.length === 0) throw new Error(`Autonomous recovery did not persist canonical ProductShape model nodes; extracted candidates=${await window.locator(".app-shell").getAttribute("data-pdac-candidate-count")}; textLength=${await window.locator(".app-shell").getAttribute("data-pdac-text-length")}`);
  const productShapeResponse = await productShapeMessage.innerText();
  if ((await productShapeMessage.locator(".chat-diagram").count()) !== 0) throw new Error("ProductShape duplicated the full Mermaid diagram in chat");
  if ((await productShapeMessage.locator(".chat-diagram-link").count()) !== 1 && (await window.locator('[data-testid="pdac-tldraw-canvas"]').count()) === 0) throw new Error("ProductShape response did not expose a central diagram or explain where it moved");
  const productShapeScreenshot = "docs/implementation/evidence/F05-T01-notes-productshape-real.png";
  await window.locator(".chat-messages").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await window.screenshot({ path: resolve(root, productShapeScreenshot), fullPage: false });
  await writeFile(resolve(root, "docs/implementation/evidence/F05-T01-notes-productshape-real.md"), `${productShapeResponse}\n`, "utf8");

  await window.getByTitle("C4 y escenarios").click();
  await window.getByRole("heading", { name: "Arquitectura" }).waitFor();
  await window.getByLabel("Mensaje para OMP").fill(
    "ARCHITECTURE: inspecciona src/drumcoach_app, src/drumcoach_spike y tests de Notes/DrumCoach. Describe sólo componentes, entradas, salidas, persistencia y relaciones confirmadas en el código. Devuelve máximo 6 hallazgos con rutas y termina con un único bloque Mermaid flowchart LR de la arquitectura real. No inventes componentes.",
  );
  const architectureCount = await window.locator(".message-row.omp").count();
  await window.getByRole("button", { name: "Enviar mensaje" }).click();
  await window.waitForFunction((count) => document.querySelectorAll(".message-row.omp").length > count, architectureCount, { timeout: 180_000 });
  const architectureMessage = window.locator(".message-row.omp").last();
  await architectureMessage.waitFor({ timeout: 180_000 });
  await window.locator('[data-chat-status="settled"]').waitFor({ timeout: 180_000 });
  const architectureResponse = await architectureMessage.innerText();
  if ((await architectureMessage.locator(".chat-diagram").count()) !== 0 || (await architectureMessage.locator(".chat-diagram-link").count()) !== 1) throw new Error("Architecture response should keep Mermaid only in the central map");
  const architectureScreenshot = "docs/implementation/evidence/F05-T02-notes-architecture-real.png";
  await window.locator(".chat-messages").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await window.screenshot({ path: resolve(root, architectureScreenshot), fullPage: false });
  await writeFile(resolve(root, "docs/implementation/evidence/F05-T02-notes-architecture-real.md"), `${architectureResponse}\n`, "utf8");

  console.log(JSON.stringify({
    mode: "real",
    projectRoot: testProjectRoot,
    productShape: { responsePreview: productShapeResponse.slice(0, 5000), screenshot: productShapeScreenshot },
    architecture: { responsePreview: architectureResponse.slice(0, 5000), screenshot: architectureScreenshot },
  }, null, 2));
} finally {
  await app.close();
  await rm(testProjectRoot, { recursive: true, force: true });
  await rm(testRegistryPath, { force: true });
}
