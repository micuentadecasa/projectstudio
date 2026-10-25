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
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1" },
});
try {
  const window = await app.firstWindow();
  const resizeDirections = await window.locator(".sidebar, .chat-panel").evaluateAll((elements) => elements.map((element) => getComputedStyle(element).resize));
  if (resizeDirections.some((direction) => direction !== "horizontal")) throw new Error(`panel resize contract failed: ${resizeDirections.join(",")}`);
  await window.locator(".sidebar").waitFor({ timeout: 30_000 });
  await window.getByTitle("Añadir o crear referencia a un proyecto local").waitFor();
  if (!(await window.getByLabel("Mensaje para OMP").isVisible())) throw new Error("chat composer is not visible");
  await window.getByRole("button", { name: "Entender el proyecto" }).waitFor();
  await window.getByRole("button", { name: "Contraer explorador" }).click();
  if (!(await window.locator(".sidebar.collapsed").count())) throw new Error("sidebar did not collapse");
  if (await window.getByText("PROYECTOS", { exact: true }).isVisible()) throw new Error("collapsed sidebar still shows project labels");
  await window.getByRole("button", { name: "Expandir explorador" }).click();
  if (await window.locator(".sidebar.collapsed").count()) throw new Error("sidebar did not expand");

  await window.getByRole("button", { name: "Cambiar tema" }).click();
  await window.screenshot({ path: resolve(evidenceDirectory, "F04-T01-desktop-chat-light.png"), fullPage: true });
  await window.getByTitle("C4 y escenarios").click();
  await window.getByRole("heading", { name: "Arquitectura" }).waitFor();
  const initialAssistantMessages = await window.locator(".message-row.omp").count();
  await window.getByRole("button", { name: "Entender el proyecto" }).click();
  if (await window.locator(".message-row.user").count() < 1) throw new Error("objective click did not create a user command");
  try {
    await window.waitForFunction((count) => document.querySelectorAll(".message-row.omp").length > count, initialAssistantMessages, { timeout: 120_000 });
  } catch (error) {
    throw new Error(`No final assistant message: ${JSON.stringify({ error: String(error), chatStatus: await window.locator(".chat-panel").getAttribute("data-chat-status"), chatError: await window.locator(".chat-error").innerText().catch(() => ""), messages: await window.locator(".message-row").allInnerTexts() })}`);
  }
  const finalMessage = window.locator(".message-row.omp").last();
  const finalText = await finalMessage.innerText();
  if (finalText.includes("Eres el agente operativo") || finalText.includes("Flujo autorizado")) throw new Error(`Internal agent prompt leaked into chat: ${finalText}`);
  await window.waitForFunction(() => {
    const chat = document.querySelector<HTMLElement>(".chat-messages");
    return Boolean(chat && chat.scrollTop + chat.clientHeight >= chat.scrollHeight - 2);
  });
  await window.locator(".pdac-artifact-nav").waitFor({ timeout: 30_000 });
  if (await window.locator(".activity-card").count() !== 0) throw new Error("redundant ProductShape assistant card is still visible");
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
