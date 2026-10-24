import { _electron as electron, type ElectronApplication, type Page } from "playwright";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const main = resolve(root, "apps/desktop/dist/main.js");
const notesRoot = process.env.PROJECTSTUDIO_NOTES_ROOT ?? "/Users/luis/projects/notes";
const registryPath = resolve(root, ".tmp", "projectstudio-projects.json");
const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));

async function launch(projectRoot: string, extra: Record<string, string> = {}): Promise<ElectronApplication> {
  return electron.launch({
    args: [main],
    cwd: root,
    env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: projectRoot, PROJECTSTUDIO_SKIP_BOOTSTRAP: "1", ...extra },
  });
}

async function waitForProject(page: Page, name: string): Promise<void> {
  await page.waitForFunction((expected) => Array.from(document.querySelectorAll(".project-picker select option")).some((option) => option.textContent?.includes(expected)), name);
}

const originalRegistry = await readFile(registryPath, "utf8").catch(() => null);
const activeMarkerPath = resolve(root, ".tmp", "project-discovery", `${createHash("sha256").update(root).digest("hex").slice(0, 16)}.json`);
const originalMarker = await readFile(activeMarkerPath, "utf8").catch(() => null);
const fixtureRoot = resolve(root, ".tmp", "journey-new-project");
await mkdir(fixtureRoot, { recursive: true });
await writeFile(resolve(fixtureRoot, "README.md"), "# Journey fixture\n", "utf8");

let app: ElectronApplication | undefined;
try {
  app = await launch(notesRoot);
  let page = await app.firstWindow();
  await waitForProject(page, basename(notesRoot));
  await page.getByTitle("Producto y casos de uso").click();
  await page.getByRole("heading", { name: "ProductShape" }).waitFor();
  await page.locator(".generated-system-map .diagram-canvas").waitFor();
  console.log("scenario existing-notes: pass");
  await app.close();
  app = undefined;

  app = await launch(fixtureRoot);
  page = await app.firstWindow();
  await waitForProject(page, basename(fixtureRoot));
  if (!(await page.locator(".tree-root").innerText()).includes("journey-new-project")) throw new Error("new project was not registered");
  console.log("scenario new-project-reference: pass");
  await app.close();
  app = undefined;

  await writeFile(activeMarkerPath, `${JSON.stringify({ projectRoot: root, status: "running", updatedAt: new Date().toISOString() })}\n`, "utf8");
  app = await launch(root, { PROJECTSTUDIO_SKIP_BOOTSTRAP: "0" });
  page = await app.firstWindow();
  await page.getByRole("button", { name: "Entender el proyecto" }).waitFor();
  await page.locator(".chat-activity").filter({ hasText: "Descubrimiento inicial en curso" }).waitFor();
  if (!(await page.getByRole("button", { name: "Entender el proyecto" }).isEnabled())) throw new Error("objective disabled while discovery is active");
  await page.getByRole("button", { name: "Entender el proyecto" }).click();
  await page.locator(".chat-activity").filter({ hasText: "Objetivo preparado" }).waitFor();
  console.log("scenario active-discovery-queues-objective: pass");
  await app.close();
  app = undefined;

  app = await launch(root, { OMP_BIN: "/definitely/missing/omp" });
  page = await app.firstWindow();
  await page.locator(".chat-error").waitFor();
  const errorText = await page.locator(".chat-error").innerText();
  if (!errorText.includes("No se pudo conectar con OMP")) throw new Error(`unexpected OMP error surface: ${errorText}`);
  console.log("scenario omp-error: pass");
} finally {
  await app?.close();
  if (originalRegistry === null) await unlink(registryPath).catch(() => undefined);
  else await writeFile(registryPath, originalRegistry, "utf8");
  if (originalMarker === null) await unlink(activeMarkerPath).catch(() => undefined);
  else await writeFile(activeMarkerPath, originalMarker, "utf8");
  await access(fixtureRoot);
}
