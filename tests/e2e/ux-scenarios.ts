import { _electron as electron, type Page } from "playwright";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type StepEvidence = {
  id: string;
  screenshot: string;
  activeTab: string;
  center: string;
  chat: string;
  suggestions: string;
  checks: Record<string, boolean>;
};

const root = resolve(import.meta.dirname, "../..");
const main = resolve(root, "apps/desktop/dist/main.js");
const evidenceDirectory = resolve(root, "docs/implementation/evidence/ux-scenarios");
const registryPath = resolve(root, ".tmp/projectstudio-projects.json");
const greenfieldRoot = resolve(root, ".tmp/ux-greenfield-biblioteca");
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

function projectId(projectPath: string): string {
  return createHash("sha256").update(resolve(projectPath)).digest("hex").slice(0, 16);
}

async function removeGreenfieldReferences(): Promise<void> {
  const key = projectId(greenfieldRoot);
  await Promise.all([
    rm(resolve(root, ".tmp/project-analysis", `${key}.json`), { force: true }),
    rm(resolve(root, ".tmp/project-discovery", `${key}.json`), { force: true }),
  ]);
  try {
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as { activeId: string; projects: Array<{ id: string; path: string }> };
    registry.projects = registry.projects.filter((project) => resolve(project.path) !== greenfieldRoot);
    if (!registry.projects.some((project) => project.id === registry.activeId)) registry.activeId = registry.projects[0]?.id ?? "";
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  } catch {
    // The registry is optional in a clean checkout.
  }
}

async function captureStep(page: Page, id: string): Promise<StepEvidence> {
  const screenshot = `docs/implementation/evidence/ux-scenarios/${id}.png`;
  await page.screenshot({ path: resolve(root, screenshot), fullPage: false });
  const activeTab = await page.locator(".view-tab.active").innerText();
  const center = await page.locator(".content-scroll").innerText();
  const chat = await page.locator(".chat-messages").innerText();
  const suggestions = await page.locator(".chat-suggestions").innerText();
  const checks = {
    centralSurfaceVisible: await page.locator(".pdac-workbench, .dashboard-grid").count() > 0,
    diagramSurfaceVisible: await page.locator(".pdac-diagram-card, .architecture-card").count() > 0,
    chatHasNoInternalPrompt: !/Eres el agente operativo|Flujo autorizado|GREENFIELD:|brownfield-discovery/i.test(chat),
    statusIsSingleSource: await page.locator(".chat-activity").count() === 0,
    chatAndCenterAgreeOnProductSurface: activeTab.includes("ProductShape") === (await page.locator(".pdac-workbench").count() > 0),
  };
  if (Object.values(checks).some((value) => !value)) throw new Error(`${id}: UX coherence check failed: ${JSON.stringify(checks)}`);
  return { id, screenshot, activeTab, center: center.slice(0, 1200), chat: chat.slice(-1800), suggestions, checks };
}

async function waitForSettled(page: Page, previousMessages: number): Promise<void> {
  await page.waitForFunction((count: number) => document.querySelectorAll(".message-row.omp").length > count, previousMessages, { timeout: 180_000 });
  await page.locator('[data-chat-status="settled"]').waitFor({ timeout: 180_000 });
}

async function runBrownfield(): Promise<StepEvidence[]> {
  const app = await electron.launch({
    args: [main],
    cwd: root,
    env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1", PROJECTSTUDIO_PROJECT_ROOT: "/Users/luis/projects/notes" },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.includes("notes"), undefined, { timeout: 30_000 });
    await page.getByTitle("Producto y casos de uso").click();
    await page.locator(".pdac-workbench").waitFor({ timeout: 30_000 });
    const steps = [await captureStep(page, "F06-UX-B01-notes-loaded")];
    const initialMessages = await page.locator(".message-row.omp").count();
    const action = page.locator(".chat-suggestions-grid button").first();
    await action.waitFor({ timeout: 30_000 });
    await action.click();
    await waitForSettled(page, initialMessages);
    steps.push(await captureStep(page, "F06-UX-B02-notes-after-omp"));
    const currentFocus = await page.locator(".chat-suggestions-label").innerText();
    if (!currentFocus.includes("Foco actual") && !currentFocus.includes("Siguiente foco")) throw new Error(`Brownfield chat did not suggest a contextual next step: ${currentFocus}`);
    return steps;
  } finally {
    await app.close();
  }
}

async function runGreenfield(): Promise<StepEvidence[]> {
  await rm(greenfieldRoot, { recursive: true, force: true });
  await mkdir(greenfieldRoot, { recursive: true });
  const app = await electron.launch({
    args: [main],
    cwd: root,
    env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: greenfieldRoot },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => document.body.innerText.includes("Este proyecto está vacío"), undefined, { timeout: 30_000 });
    await page.getByTitle("Producto y casos de uso").click();
    await page.getByRole("button", { name: "Definir primer caso de uso", exact: true }).waitFor();
    const steps = [await captureStep(page, "F06-UX-G01-greenfield-ready")];
    const initialMessages = await page.locator(".message-row.omp").count();
    await page.getByLabel("Mensaje para OMP").fill("Quiero que una persona pueda reservar una plaza en un taller local y recibir confirmación.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await waitForSettled(page, initialMessages);
    steps.push(await captureStep(page, "F06-UX-G02-greenfield-after-omp"));
    const suggestions = await page.locator(".chat-suggestions").innerText();
    if (suggestions.includes("Definir primer caso de uso")) throw new Error("Greenfield kept its initial action after OMP returned a result");
    return steps;
  } finally {
    await app.close();
    await removeGreenfieldReferences();
    await rm(greenfieldRoot, { recursive: true, force: true });
  }
}

await mkdir(evidenceDirectory, { recursive: true });
const result = {
  mode: "real-omp",
  brownfield: await runBrownfield(),
  greenfield: await runGreenfield(),
  repositoriesModified: false,
};
await writeFile(resolve(evidenceDirectory, "F06-UX-review.md"), `${JSON.stringify(result, null, 2)}\n\nEvaluación manual posterior: revisar cada PNG preguntando si el siguiente paso es obvio, si chat y centro nombran el mismo foco, si el diagrama muestra el último resultado y si no aparece ningún prompt interno.\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
