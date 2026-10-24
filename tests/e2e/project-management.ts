import { _electron as electron } from "playwright";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const main = resolve(root, "apps/desktop/dist/main.js");
const projectRoot = root;
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const app = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: projectRoot, PROJECTSTUDIO_SKIP_BOOTSTRAP: "1" },
});
try {
  const window = await app.firstWindow();
  await window.getByText("PROYECTOS", { exact: true }).waitFor();
  await window.getByTitle("Archivar referencia; no borra archivos").click();
  await window.locator(".project-row.archived").filter({ hasText: "projectstudio" }).waitFor();
  await access(projectRoot);
  console.log(JSON.stringify({ archivedReferenceOnly: true, projectPathStillExists: true, projectRoot }, null, 2));
} finally {
  await app.close();
}
