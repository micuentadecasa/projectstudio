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
  await window.getByRole("heading", { name: "ProductShape" }).waitFor();
  await window.getByRole("heading", { name: "Lo que va encontrando" }).waitFor();
  await window.getByText("GUÍA PDAC · SIGUIENTE PASO", { exact: true }).waitFor();
  if (await window.locator(".welcome-strip").count() !== 0) throw new Error("ProductShape still shows the duplicated upper status");
  if (await window.locator(".pdac-guide-card").count() !== 1) throw new Error("ProductShape guide card is missing");
  await window.getByRole("button", { name: /Casos de uso/ }).click();
  await window.getByRole("heading", { level: 1, name: "Casos de uso" }).waitFor();
  await window.getByText("ENTIDAD PDAC", { exact: true }).waitFor();
  await window.getByRole("button", { name: /Actores/ }).click();
  await window.getByRole("heading", { level: 1, name: "Actores" }).waitFor();
  await window.getByRole("button", { name: "← Volver al estado" }).click();
  await window.getByRole("heading", { name: "Borrador PDAC provisional" }).waitFor();
  await window.getByText("MAPA PDAC · EVIDENCIA", { exact: true }).waitFor();
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
