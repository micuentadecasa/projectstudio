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
  await window.waitForFunction(() => Array.from(document.querySelectorAll(".project-picker select option")).some((option) => option.textContent?.includes("notes")), undefined, { timeout: 30_000 });
  await window.getByTitle("Producto y casos de uso").click();
  await window.locator(".pdac-artifact-nav").waitFor();
  await window.locator(".pdac-details-card").waitFor();
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
  await window.getByRole("button", { name: /Dominio/ }).click();
  await window.getByText("GLOSARIO DEL DOMINIO · EVIDENCIA", { exact: true }).waitFor();
  await window.locator(".pdac-tldraw-stage").waitFor();
  await window.getByRole("button", { name: "← Estado general" }).click();
  await window.locator(".generated-system-map .diagram-canvas").waitFor({ timeout: 30_000 });
  const source = await window.locator(".generated-system-map .diagram-canvas").innerText();
  if (!source.includes("MuScriptor") || !source.includes("SQLite")) throw new Error(`Stored ProductShape diagram is incomplete: ${source}`);
  const screenshot = "docs/implementation/evidence/F05-T06-notes-stored-diagram.png";
  await window.screenshot({ path: resolve(root, screenshot), fullPage: true });
  await writeFile(resolve(evidenceDirectory, "F05-T06-notes-stored-diagram.md"), `${source}\n`, "utf8");
  console.log(JSON.stringify({ mode: "real", projectRoot: notesRoot, tokensUsed: false, screenshot, source }, null, 2));
} finally {
  await app.close();
}
