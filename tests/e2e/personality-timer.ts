import { _electron as electron, type Page } from "playwright";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const main = resolve(root, "apps/desktop/dist/main.js");
const projectPath = resolve(root, ".tmp/e2e-personality-timer");
const registryPath = resolve(root, ".tmp/e2e-personality-projects.json");
const userData = resolve(root, ".tmp/e2e-personality-user-data");
const environment = { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)), PROJECTSTUDIO_PROJECT_REGISTRY: registryPath };

await rm(projectPath, { recursive: true, force: true });
await rm(userData, { recursive: true, force: true });
await mkdir(resolve(projectPath, ".product/generated"), { recursive: true });
await writeFile(resolve(projectPath, "README.md"), "# Temporizador de personalidad\n\nProyecto brownfield desechable para validar continuidad agentica.\n", "utf8");
await writeFile(resolve(projectPath, ".product/generated/product-graph.json"), `${JSON.stringify({
  schema: "product-definition-as-code/graph/v1alpha1",
  nodes: [
    { id: "actor-user", type: "actor", title: "Actor: persona usuaria", status: "confirmed", path: "README.md" },
    { id: "use-case-review", type: "use-case", title: "Caso de uso: revisar hallazgos", status: "confirmed", path: "README.md" },
    { id: "rule-review", type: "business-rule", title: "Regla: conservar trazabilidad", status: "confirmed", path: "README.md" },
  ],
  edges: [{ from: "actor-user", kind: "uses", to: "use-case-review" }, { from: "use-case-review", kind: "obeys", to: "rule-review" }],
}, null, 2)}\n`, "utf8");

async function cleanRegistry(): Promise<void> {
  try {
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as { activeId: string; projects: Array<{ id: string; path: string }> };
    registry.projects = registry.projects.filter((project) => resolve(project.path) !== projectPath);
    if (!registry.projects.some((project) => project.id === registry.activeId)) registry.activeId = registry.projects[0]?.id ?? "";
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  } catch {
    // Registry may not exist in a clean checkout.
  }
}
async function waitForSettled(page: Page, previousMessages: number): Promise<void> {
  await page.waitForFunction((count) => document.querySelectorAll(".message-row.omp").length > count, previousMessages, { timeout: 180_000 });
  await page.locator('[data-chat-status="settled"]').waitFor({ timeout: 180_000 });
}

let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
try {
  app = await electron.launch({
    args: [`--user-data-dir=${userData}`, main],
    cwd: root,
    env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1", PROJECTSTUDIO_PROJECT_ROOT: projectPath },
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => document.querySelector('[aria-label="Tiempo de inactividad de la personalidad"]') !== null, undefined, { timeout: 30_000 });
  await page.getByTitle("Producto y casos de uso").click();
  await page.locator(".pdac-workbench").waitFor({ timeout: 30_000 });
  const setting = page.getByLabel("Tiempo de inactividad de la personalidad");
  await setting.selectOption("10000");
  await page.locator('[data-personality-status="waiting"]').waitFor({ timeout: 30_000 });
  await page.locator('[role="status"]').filter({ hasText: "continúa en" }).waitFor({ timeout: 5_000 });
  await page.screenshot({ path: resolve(root, "docs/implementation/evidence/F07-personality-timer-01-countdown.png"), fullPage: false });
  const firstCountdown = await page.locator('[role="status"]').filter({ hasText: "continúa en" }).innerText();
  await page.waitForTimeout(2_000);
  const secondCountdown = await page.locator('[role="status"]').filter({ hasText: "continúa en" }).innerText();
  if (firstCountdown === secondCountdown) throw new Error(`La cuenta atrás no avanza: ${firstCountdown}`);
  const composer = page.getByLabel("Mensaje para OMP");
  const messagesBeforePendingComposer = await page.locator(".message-row.omp").count();
  await composer.fill("Pregunta pendiente que el usuario aún no ha enviado");
  await page.waitForTimeout(11_000);
  if (await page.locator(".message-row.omp").count() !== messagesBeforePendingComposer) throw new Error("La personalidad ejecutó OMP mientras el usuario tenía una pregunta pendiente");
  if (await page.locator('[data-personality-status="working"]').count() !== 0) throw new Error("La personalidad salió de espera con texto pendiente en el composer");
  await composer.fill("");
  const previousMessages = await page.locator(".message-row.omp").count();
  await page.locator('[data-personality-status="working"]').waitFor({ timeout: 30_000 });
  await page.screenshot({ path: resolve(root, "docs/implementation/evidence/F07-personality-timer-02-working.png"), fullPage: false });
  await waitForSettled(page, previousMessages);
  const chat = await page.locator(".chat-messages").innerText();
  if (/REVISIÓN PROACTIVA|PDAC COMPLETO|No inventes datos/i.test(chat)) throw new Error("El prompt interno de personalidad se filtró al chat");
  await writeFile(resolve(root, "docs/implementation/evidence/F07-personality-timer-report.json"), `${JSON.stringify({ mode: "real-omp", threshold: "10s", countdownAdvances: firstCountdown !== secondCountdown, pendingComposerBlocksProactive: true, proactiveRunSettled: true, internalPromptHidden: true }, null, 2)}
`, "utf8");
  console.log(JSON.stringify({ threshold: "10s", countdownAdvances: true, pendingComposerBlocksProactive: true, proactiveRunSettled: true, internalPromptHidden: true }));
} finally {
  await app?.close();
  await rm(userData, { recursive: true, force: true });
  await rm(projectPath, { recursive: true, force: true });
  await cleanRegistry();
}
