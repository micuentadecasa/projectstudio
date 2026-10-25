import { _electron as electron } from "playwright";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Scenario = {
  slug: string;
  prompt: string;
  expected: RegExp;
};

const root = resolve(import.meta.dirname, "../..");
const scenarioRoot = resolve(root, ".tmp/e2e-greenfield-scenarios");
const main = resolve(root, "apps/desktop/dist/main.js");
const evidenceDirectory = resolve(root, "docs/implementation/evidence");
const registryPath = resolve(root, ".tmp/projectstudio-projects.json");
const scenarios: Scenario[] = [
  {
    slug: "biblioteca-musical",
    prompt: "Quiero una biblioteca musical personal que permita importar una partitura y encontrarla rápidamente para practicar.",
    expected: /actor|caso de uso|pregunta|resultado/i,
  },
  {
    slug: "reservas-taller",
    prompt: "Quiero que una persona pueda reservar una plaza en un taller local y recibir confirmación de la reserva.",
    expected: /actor|caso de uso|pregunta|resultado/i,
  },
  {
    slug: "inventario-huerto",
    prompt: "Quiero registrar cultivos de un huerto, consultar su estado y saber cuándo toca regar cada parcela.",
    expected: /actor|caso de uso|pregunta|resultado/i,
  },
];

const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

function projectKey(projectPath: string): string {
  return createHash("sha256").update(resolve(projectPath)).digest("hex").slice(0, 16);
}

async function removeProjectArtifacts(projectPath: string): Promise<void> {
  const key = projectKey(projectPath);
  await Promise.all([
    rm(resolve(root, ".tmp/project-analysis", `${key}.json`), { force: true }),
    rm(resolve(root, ".tmp/project-discovery", `${key}.json`), { force: true }),
  ]);
}

async function removeRegistryReferences(): Promise<void> {
  try {
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as { activeId: string; projects: Array<{ id: string; path: string }>; version: number };
    const temporaryPaths = new Set(scenarios.map((scenario) => resolve(scenarioRoot, scenario.slug)));
    registry.projects = registry.projects.filter((project) => !temporaryPaths.has(resolve(project.path)));
    if (!registry.projects.some((project) => project.id === registry.activeId)) {
      registry.activeId = registry.projects[0]?.id ?? "";
    }
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  } catch {
    // The registry is optional during a first run.
  }
}

async function runScenario(scenario: Scenario): Promise<{ slug: string; response: string; screenshot: string }> {
  const projectPath = resolve(scenarioRoot, scenario.slug);
  await mkdir(projectPath, { recursive: true });
  const app = await electron.launch({
    args: [main],
    cwd: root,
    env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: projectPath },
  });
  try {
    const window = await app.firstWindow();
    await window.waitForFunction(
      (slug) => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.includes(slug),
      scenario.slug,
      { timeout: 30_000 },
    );
    await window.waitForFunction(() => document.body.innerText.includes("Este proyecto está vacío"), undefined, { timeout: 30_000 });
    await window.getByTitle("Producto y casos de uso").click();
    await window.getByText("Cuéntame el primer caso de uso", { exact: true }).waitFor();
    const initialOmpMessages = await window.locator(".message-row.omp").count();
    if (initialOmpMessages !== 1) throw new Error(`${scenario.slug}: expected one initial guidance message, got ${initialOmpMessages}`);

    await window.getByLabel("Mensaje para OMP").fill(scenario.prompt);
    await window.getByRole("button", { name: "Enviar mensaje" }).click();
    await window.locator(".pdac-activity-line").waitFor({ timeout: 30_000 });
    await window.waitForFunction(
      (count) => document.querySelectorAll(".message-row.omp").length > count,
      initialOmpMessages,
      { timeout: 180_000 },
    );
    await window.waitForFunction(
      () => document.querySelector('[data-chat-status="settled"]') !== null,
      undefined,
      { timeout: 180_000 },
    );
    const response = await window.locator(".message-row.omp").last().innerText();
    if (!scenario.expected.test(response)) throw new Error(`${scenario.slug}: response did not continue PDAC interview:\n${response}`);
    if (await window.locator(".message-row.user").filter({ hasText: "GREENFIELD:" }).count() !== 0) {
      throw new Error(`${scenario.slug}: internal Greenfield prompt leaked into chat`);
    }

    const screenshot = `docs/implementation/evidence/F06-T15-${scenario.slug}.png`;
    await window.screenshot({ path: resolve(root, screenshot), fullPage: false });
    await writeFile(resolve(evidenceDirectory, `F06-T15-${scenario.slug}.md`), `${response}\n`, "utf8");
    return { slug: scenario.slug, response: response.slice(0, 1200), screenshot };
  } finally {
    await app.close();
  }
}

await rm(scenarioRoot, { recursive: true, force: true });
await mkdir(evidenceDirectory, { recursive: true });
try {
  const results: Array<{ slug: string; response: string; screenshot: string }> = [];
  for (const scenario of scenarios) {
    const projectPath = resolve(scenarioRoot, scenario.slug);
    try {
      results.push(await runScenario(scenario));
    } finally {
      await rm(projectPath, { recursive: true, force: true });
      await removeProjectArtifacts(projectPath);
    }
  }
  await removeRegistryReferences();
  const leftovers = await readdir(scenarioRoot).catch(() => []);
  if (leftovers.length !== 0) throw new Error(`Greenfield scenario root was not cleaned: ${leftovers.join(", ")}`);
  console.log(JSON.stringify({ mode: "real", scenarios: results, cleaned: true }, null, 2));
} finally {
  await rm(scenarioRoot, { recursive: true, force: true });
  await removeRegistryReferences();
}
