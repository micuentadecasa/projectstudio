import { _electron as electron } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
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
  await window.waitForFunction(() => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.startsWith("notes"), undefined, { timeout: 30_000 });
  const selectedProject = await window.locator(".project-picker select option:checked").innerText();
  if (!selectedProject.startsWith("notes")) throw new Error(`unexpected project label: ${selectedProject}`);

  await window.getByTitle("Producto y casos de uso").click();
  await window.locator(".pdac-artifact-nav").waitFor();
  const productShapeCount = await window.locator(".message-row.omp").count();
  await window.getByRole("button", { name: "Revisar", exact: true }).click();
  if (await window.locator(".message-row.user").filter({ hasText: "PRODUCTSHAPE:" }).count() !== 0) throw new Error("ProductShape internal action prompt leaked into chat");
  await window.waitForFunction((count) => document.querySelectorAll(".message-row.omp").length > count || document.querySelector(".pdac-activity-line") !== null, productShapeCount, { timeout: 30_000 });
  if (await window.locator(".pdac-activity-line").count() > 0) {
    if (await window.locator(".pdac-activity-line").count() !== 1 || await window.locator(".pdac-live-progress").count() !== 0) throw new Error("ProductShape exposes duplicate central activity status");
  }
  await window.waitForFunction((count) => document.querySelectorAll(".message-row.omp").length > count, productShapeCount, { timeout: 180_000 });
  const productShapeMessage = window.locator(".message-row.omp").last();
  await productShapeMessage.waitFor({ timeout: 180_000 });
  await window.locator('[data-chat-status="settled"]').waitFor({ timeout: 180_000 });
  const productShapeResponse = await productShapeMessage.innerText();
  if ((await productShapeMessage.locator(".chat-diagram").count()) !== 0) throw new Error("ProductShape duplicated the full Mermaid diagram in chat");
  if ((await productShapeMessage.locator(".chat-diagram-link").count()) !== 1) throw new Error("ProductShape response did not explain that the diagram moved to the central map");
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
    projectRoot: notesRoot,
    productShape: { responsePreview: productShapeResponse.slice(0, 5000), screenshot: productShapeScreenshot },
    architecture: { responsePreview: architectureResponse.slice(0, 5000), screenshot: architectureScreenshot },
  }, null, 2));
} finally {
  await app.close();
}
