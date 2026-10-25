import { _electron as electron } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const notesRoot = process.env.PROJECTSTUDIO_NOTES_ROOT ?? "/Users/luis/projects/notes";
const main = resolve(root, "apps/desktop/dist/main.js");
const evidenceDirectory = resolve(root, "docs/implementation/evidence");
await mkdir(evidenceDirectory, { recursive: true });
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const app = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: notesRoot },
});
try {
  const window = await app.firstWindow();
  await window.waitForFunction(() => Array.from(document.querySelectorAll(".project-picker select option")).some((option) => option.textContent?.includes("notes")), undefined, { timeout: 30_000 });
  await window.getByTitle("Producto y casos de uso").click();
  await window.locator(".pdac-artifact-nav").waitFor();
  const graph = JSON.parse(await readFile(resolve(notesRoot, ".product/generated/product-graph.json"), "utf8")) as { nodes?: Array<{ type?: string; title?: string; path?: string }> };
  const canonicalNodes = graph.nodes?.filter((node) => node.path?.startsWith("docs/product/model/") && !node.path.endsWith("/canvas.md")) ?? [];
  if (canonicalNodes.length !== 47) throw new Error(`Notes no hidrata el grafo canónico esperado: ${canonicalNodes.length} nodos`);
  const counts = Object.fromEntries(["actor", "use-case", "domain-term", "journey", "business-rule", "constraint", "functional-requirement", "bounded-context"].map((type) => [type, canonicalNodes.filter((node) => node.type === type).length]));
  const expectedCounts = { actor: 3, "use-case": 7, "domain-term": 14, journey: 3, "business-rule": 6, constraint: 5, "functional-requirement": 4, "bounded-context": 5 };
  if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) throw new Error(`Conteos PDAC inesperados: ${JSON.stringify(counts)}`);
  const expectedArtifactCounts: Record<string, number> = { Actores: 3, "Casos de uso": 7, Dominio: 14, Journeys: 3, "Bounded contexts": 5 };
  for (const [label, count] of Object.entries(expectedArtifactCounts)) {
    const button = window.getByRole("button", { name: label, exact: true });
    const title = await button.getAttribute("title");
    if (!title?.includes(`${count} hallazgo`)) throw new Error(`Notes no hidrata ${label}: ${title ?? "sin contador"}`);
  }
  for (const label of ["Reglas", "Requisitos"]) {
    const title = await window.getByRole("button", { name: label, exact: true }).getAttribute("title");
    if (!title || !/[1-9]\d* hallazgo/.test(title)) throw new Error(`Notes no hidrata ${label}: ${title ?? "sin contador"}`);
  }
  if (await window.locator(".welcome-strip").count() !== 0) throw new Error("ProductShape still shows the duplicated upper status");
  const contentScroll = window.locator(".content-scroll");
  const scrollMetrics = await contentScroll.evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  if (scrollMetrics.scrollHeight <= scrollMetrics.clientHeight) throw new Error(`ProductShape center is not scrollable: ${JSON.stringify(scrollMetrics)}`);
  await window.getByRole("button", { name: /Casos de uso/ }).click();
  await window.getByText("Casos de uso", { exact: true }).first().waitFor();
  await window.locator(".pdac-tldraw-stage").waitFor();
  await window.getByRole("button", { name: /Actores/ }).click();
  await window.getByText("Actores", { exact: true }).first().waitFor();
  await window.locator(".pdac-tldraw-stage").waitFor();
  const actorCanvasScreenshot = "docs/implementation/evidence/F05-T06-notes-actors-tldraw.png";
  await window.screenshot({ path: resolve(root, actorCanvasScreenshot), fullPage: true });
  await window.getByRole("button", { name: "Dominio", exact: true }).click();
  await window.getByText("GLOSARIO DEL DOMINIO · EVIDENCIA", { exact: true }).waitFor();
  await window.locator(".pdac-tldraw-stage").waitFor();
  await window.getByRole("button", { name: "← Estado general" }).click();
  await window.locator(".pdac-tldraw-stage").waitFor();
  const source = await window.locator(".pdac-workbench").innerText();
  if (!source.includes("Mapa") && !source.includes("Relaciones")) throw new Error(`Stored ProductShape inventory is incomplete: ${source}`);
  const screenshot = "docs/implementation/evidence/F05-T06-notes-stored-diagram.png";
  await window.screenshot({ path: resolve(root, screenshot), fullPage: true });
  await writeFile(resolve(evidenceDirectory, "F05-T06-notes-stored-diagram.md"), `${source}\n`, "utf8");
  console.log(JSON.stringify({ mode: "real", projectRoot: notesRoot, tokensUsed: false, canonicalNodeCount: canonicalNodes.length, counts, screenshot, source }, null, 2));
} finally {
  await app.close();
}
