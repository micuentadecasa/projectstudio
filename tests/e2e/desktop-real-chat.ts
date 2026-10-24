import { _electron as electron } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const main = resolve(root, "apps/desktop/dist/main.js");
const evidenceDirectory = resolve(root, "docs/implementation/evidence");
await mkdir(evidenceDirectory, { recursive: true });
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const app = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_OMP_MODE: "real" },
});
try {
  const window = await app.firstWindow();
  await window.getByRole("heading", { name: "Tu producto, en contexto" }).waitFor();
  await window.locator(".connection-card small").filter({ hasText: "ready" }).waitFor({ timeout: 120_000 });
  await window.getByLabel("Mensaje para OMP").fill("Responde exclusivamente con OMP_REAL_OK y no uses herramientas.");
  await window.getByRole("button", { name: "Enviar mensaje" }).click();
  await window.locator(".message-row.user").filter({ hasText: "OMP_REAL_OK" }).waitFor();
  await window.waitForFunction(() => document.querySelectorAll(".message-row.omp").length >= 3, undefined, { timeout: 120_000 });
  await window.locator(".chat-footer").filter({ hasText: "settled" }).waitFor({ timeout: 120_000 });
  await window.screenshot({ path: resolve(evidenceDirectory, "F04-T03-desktop-chat-real.png"), fullPage: true });
  console.log(JSON.stringify({ mode: "real", responseMessages: await window.locator(".message-row.omp").count(), screenshot: "docs/implementation/evidence/F04-T03-desktop-chat-real.png" }, null, 2));
} finally {
  await app.close();
}
