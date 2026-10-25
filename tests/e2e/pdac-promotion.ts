import { _electron as electron } from "playwright";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const execFileAsync = promisify(execFile);
type PromotionResult = { ok: boolean; created: number; error?: string; artifacts?: Array<{ type?: string; title?: string }> };
const fixtureRoot = resolve(root, ".tmp/e2e-pdac-promotion");
const registryPath = resolve(root, ".tmp/e2e-pdac-promotion-projects.json");
const evidencePath = resolve(root, "docs/implementation/evidence/F07-T13-pdac-promotion.png");
const main = resolve(root, "apps/desktop/dist/main.js");
await rm(fixtureRoot, { recursive: true, force: true });
await rm(registryPath, { force: true });
await mkdir(fixtureRoot, { recursive: true });
await writeFile(resolve(fixtureRoot, "README.md"), "Fixture determinista para promover candidatos PDAC sin OMP.\n", "utf8");
await execFileAsync("pnpm", ["--package=@prodshape/cli@0.23.0", "dlx", "prodshape", "init", "--full", "--sdd", "none", "--force"], { cwd: fixtureRoot });
const environment = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
const app = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: fixtureRoot, PROJECTSTUDIO_PROJECT_REGISTRY: registryPath, PROJECTSTUDIO_SKIP_BOOTSTRAP: "1" },
});
try {
  const page = await app.firstWindow();
  await page.getByTitle("Producto y casos de uso").click();
  await page.locator(".pdac-artifact-nav").waitFor({ timeout: 30_000 });
  const result = await page.evaluate(async (): Promise<PromotionResult> => {
    const bridge = (window as unknown as { studio: { project: { promotePdac: (candidates: Array<Record<string, string>>) => Promise<PromotionResult> } } }).studio;
    return bridge.project.promotePdac([
      { type: "actor", title: "Learner", detail: "Persona que practica con el producto.", evidence: "README.md:1", confidence: "high" },
      { type: "use-case", title: "Start practice", detail: "La persona inicia una sesión de práctica.", evidence: "README.md:1", confidence: "medium" },
      { type: "domain-term", title: "Practice session", detail: "Sesión local de práctica del producto.", evidence: "README.md:1", confidence: "medium" },
    ]);
  });
  if (!result.ok || !result.artifacts?.some((artifact) => artifact.type === "actor" && artifact.title === "Learner")) throw new Error(`ProductShape promotion failed: ${JSON.stringify(result)}`);
  const graph = JSON.parse(await readFile(resolve(fixtureRoot, ".product/generated/product-graph.json"), "utf8")) as { nodes?: Array<{ type?: string; title?: string }> };
  const types = new Set((graph.nodes ?? []).map((node) => node.type));
  if (!types.has("actor") || !types.has("use-case") || !types.has("domain-term") || !types.has("bounded-context")) throw new Error(`Incomplete canonical graph: ${JSON.stringify(graph)}`);
  await page.reload();
  await page.getByTitle("Producto y casos de uso").click();
  await page.getByRole("button", { name: "Actores", exact: true }).click();
  await page.locator(".pdac-tldraw-stage").waitFor({ timeout: 30_000 });
  await page.screenshot({ path: evidencePath, fullPage: false });
  console.log(JSON.stringify({ ok: true, created: result.created, nodeCount: graph.nodes?.length ?? 0, types: [...types], screenshot: "docs/implementation/evidence/F07-T13-pdac-promotion.png" }, null, 2));
} finally {
  await app.close();
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(registryPath, { force: true });
}
