import { _electron as electron } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const main = resolve(root, "apps/desktop/dist/main.js");
const notesRoot = process.env.PROJECTSTUDIO_NOTES_ROOT ?? "/Users/luis/projects/notes";
const evidenceDirectory = resolve(root, "docs/implementation/evidence");
await mkdir(evidenceDirectory, { recursive: true });
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const first = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1", PROJECTSTUDIO_PROJECT_ROOT: notesRoot },
});
try {
  const page = await first.firstWindow();
  await page.getByRole("tab", { name: /ProductShape/ }).click();
  await page.locator(".pdac-workbench").waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: "Actores", exact: true }).click();
  await page.locator(".actors-screen").waitFor({ timeout: 30_000 });
  await page.screenshot({ path: resolve(evidenceDirectory, "F06-T18-session-before-close.png"), fullPage: false });
} finally {
  await first.close();
}

const reopened = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_SKIP_BOOTSTRAP: "1" },
});
try {
  const page = await reopened.firstWindow();
  await page.waitForFunction(() => document.querySelector<HTMLSelectElement>(".project-picker select option:checked")?.textContent?.includes("notes"), undefined, { timeout: 30_000 });
  await page.locator(".actors-screen").waitFor({ timeout: 30_000 });
  const selectedTab = await page.locator(".view-tab.active").innerText();
  const project = await page.locator(".project-picker select option:checked").innerText();
  if (!selectedTab.includes("ProductShape")) throw new Error(`ProductShape phase was not restored: ${selectedTab}`);
  if (!project.includes("notes")) throw new Error(`Active project was not restored: ${project}`);
  await page.screenshot({ path: resolve(evidenceDirectory, "F06-T18-session-after-reopen.png"), fullPage: false });
  console.log(JSON.stringify({ project, selectedTab, focus: "Actores", sameProject: true, samePhase: true }, null, 2));
} finally {
  await reopened.close();
}
