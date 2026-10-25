import { _electron as electron } from "playwright";
import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const greenfieldRoot = process.env.PROJECTSTUDIO_GREENFIELD_ROOT ?? resolve(root, "tests/fixtures/greenfield-empty");
const main = resolve(root, "apps/desktop/dist/main.js");
const evidenceDirectory = resolve(root, "docs/implementation/evidence");
await mkdir(evidenceDirectory, { recursive: true });
const projectKey = createHash("sha256").update(resolve(greenfieldRoot)).digest("hex").slice(0, 16);
await rm(resolve(root, ".tmp/project-analysis", `${projectKey}.json`), { force: true });
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const app = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: greenfieldRoot },
});
try {
  const window = await app.firstWindow();
  await window.waitForFunction(() => document.body.innerText.includes("Este proyecto está vacío"), undefined, { timeout: 30_000 });
  await window.getByTitle("Producto y casos de uso").click();
  await window.getByText("Cuéntame el primer caso de uso", { exact: true }).waitFor();
  const initialOmpMessages = await window.locator(".message-row.omp").count();
  if (initialOmpMessages !== 1) throw new Error(`Greenfield should start with one guidance message, got ${initialOmpMessages}`);

  await window.getByLabel("Mensaje para OMP").fill("Quiero que un músico pueda registrar una canción y practicarla sin conexión.");
  await window.getByRole("button", { name: "Enviar mensaje" }).click();
  await window.locator(".pdac-activity-line").waitFor({ timeout: 30_000 });
  await window.waitForFunction((count) => document.querySelectorAll(".message-row.omp").length > count, initialOmpMessages, { timeout: 180_000 });
  await window.locator('[data-chat-status="settled"]').waitFor({ timeout: 180_000 });
  const response = await window.locator(".message-row.omp").last().innerText();
  if (!/actor|caso de uso|pregunta|resultado/i.test(response)) throw new Error(`Greenfield response did not start PDAC interview:\n${response}`);
  const screenshot = "docs/implementation/evidence/F06-T03-greenfield-interview.png";
  await window.screenshot({ path: resolve(root, screenshot), fullPage: false });
  await writeFile(resolve(evidenceDirectory, "F06-T03-greenfield-interview.md"), `${response}\n`, "utf8");
  await window.waitForTimeout(500);
  await app.close();
  const reopened = await electron.launch({
    args: [main],
    cwd: root,
    env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: greenfieldRoot },
  });
  try {
    const resumed = await reopened.firstWindow();
    await resumed.waitForFunction(() => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.includes("greenfield-empty"), undefined, { timeout: 30_000 });
    await resumed.getByText(/He recuperado .* hallazgo/, { exact: false }).waitFor({ timeout: 30_000 });
  } finally {
    await reopened.close();
  }
} finally {
  if (app.context().pages().length > 0) await app.close();
}
