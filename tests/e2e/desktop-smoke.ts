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
  env: { ...environment, ELECTRON_IS_DEV: "0" },
});
try {
  const window = await app.firstWindow();
  await window.getByRole("heading", { name: "Tu producto, en contexto" }).waitFor();
  const resizeDirections = await window.locator(".sidebar, .chat-panel").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).resize));
  if (resizeDirections.some((direction) => direction !== "horizontal")) throw new Error(`panel resize contract failed: ${resizeDirections.join(",")}`);
  await window.screenshot({ path: resolve(evidenceDirectory, "F04-T01-desktop-chat-dark.png"), fullPage: true });

  await window.getByRole("button", { name: "Cambiar tema" }).click();
  await window.screenshot({ path: resolve(evidenceDirectory, "F04-T01-desktop-chat-light.png"), fullPage: true });
  await window.getByTitle("C4 y escenarios").click();
  await window.getByRole("heading", { name: "Arquitectura" }).waitFor();
  await window.getByLabel("Mensaje para OMP").fill("Responde exclusivamente con OMP_REAL_OK y no uses herramientas.");
  await window.getByRole("button", { name: "Enviar mensaje" }).click();
  await window.getByText("OMP_REAL_OK").waitFor({ timeout: 120_000 });
  await window.screenshot({ path: resolve(evidenceDirectory, "F04-T03-desktop-chat-real.png"), fullPage: true });

  const result = {
    title: await window.title(),
    activeSection: await window.locator("h1").innerText(),
    theme: await window.locator(".app-shell").getAttribute("class"),
    screenshots: ["docs/implementation/evidence/F04-T01-desktop-chat-dark.png", "docs/implementation/evidence/F04-T01-desktop-chat-light.png", "docs/implementation/evidence/F04-T03-desktop-chat-real.png"],
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app.close();
}
