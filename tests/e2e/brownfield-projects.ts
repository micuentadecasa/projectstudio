import { _electron as electron } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type BrownfieldScenario = { slug: string; root: string };
const root = resolve(import.meta.dirname, "../..");
const evidenceDirectory = resolve(root, "docs/implementation/evidence");
const scenarios: BrownfieldScenario[] = [
  { slug: "pianolesson", root: process.env.PROJECTSTUDIO_PIANOLESSON_ROOT ?? "/Users/luis/projects/pianolesson" },
  { slug: "pinto", root: process.env.PROJECTSTUDIO_PINTO_ROOT ?? "/Users/luis/projects/pinto" },
];
const main = resolve(root, "apps/desktop/dist/main.js");
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
await mkdir(evidenceDirectory, { recursive: true });

const results: Array<{ slug: string; root: string; response: string; screenshot: string }> = [];
for (const scenario of scenarios) {
  const app = await electron.launch({
    args: [main],
    cwd: root,
    env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1", PROJECTSTUDIO_PROJECT_ROOT: scenario.root },
  });
  try {
    const window = await app.firstWindow();
    await window.waitForFunction(
      (slug) => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.startsWith(slug),
      scenario.slug,
      { timeout: 30_000 },
    );
    await window.getByTitle("Producto y casos de uso").click();
    await window.locator(".pdac-artifact-nav").waitFor();
    if (await window.getByText(/GREENFIELD · DISEÑO PDAC/).count() !== 0) throw new Error(`${scenario.slug}: project incorrectly shown as Greenfield`);
    const initialOmpMessages = await window.locator(".message-row.omp").count();
    await window.getByRole("button", { name: "Revisar", exact: true }).click();
    if (await window.locator(".message-row.user").filter({ hasText: "PRODUCTSHAPE:" }).count() !== 0) throw new Error(`${scenario.slug}: internal review prompt leaked into chat`);
    await window.waitForFunction(
      (count) => document.querySelectorAll(".message-row.omp").length > count,
      initialOmpMessages,
      { timeout: 180_000 },
    );
    await window.locator('[data-chat-status="settled"]').waitFor({ timeout: 180_000 });
    const responseLocator = window.locator(".message-row.omp").last();
    const response = await responseLocator.innerText();
    if (await responseLocator.locator(".chat-diagram").count() !== 0) throw new Error(`${scenario.slug}: full Mermaid duplicated in chat`);
    if (await responseLocator.locator(".chat-diagram-link").count() !== 1) throw new Error(`${scenario.slug}: result did not point to central map`);

    for (const artifact of [/Actores/, /Casos de uso/, /Dominio/, /Journeys/]) {
      await window.getByRole("button", { name: artifact }).click();
      await window.locator(".pdac-tldraw-stage").waitFor();
    }
    const screenshot = `docs/implementation/evidence/F06-T16-${scenario.slug}.png`;
    await window.screenshot({ path: resolve(root, screenshot), fullPage: false });
    await writeFile(resolve(evidenceDirectory, `F06-T16-${scenario.slug}.md`), `${response}\n`, "utf8");
    results.push({ slug: scenario.slug, root: scenario.root, response: response.slice(0, 1200), screenshot });
  } finally {
    await app.close();
  }
}
console.log(JSON.stringify({ mode: "real", scenarios: results, repositoriesModified: false }, null, 2));
