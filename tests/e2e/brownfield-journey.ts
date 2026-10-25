import { _electron as electron } from "playwright";
import { createHash } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const main = resolve(root, "apps/desktop/dist/main.js");
const projectRoot = root;
const key = createHash("sha256").update(projectRoot).digest("hex").slice(0, 16);
const markerPath = resolve(root, ".tmp", "project-discovery", `${key}.json`);
const originalMarker = await readFile(markerPath, "utf8").catch(() => null);
await writeFile(markerPath, `${JSON.stringify({ projectRoot, status: "running", updatedAt: new Date(Date.now() - 60_000).toISOString() })}\n`, "utf8");
const environment = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const app = await electron.launch({
  args: [main],
  cwd: root,
  env: { ...environment, ELECTRON_IS_DEV: "0", PROJECTSTUDIO_PROJECT_ROOT: projectRoot },
});
try {
  const window = await app.firstWindow();
  await window.getByRole("button", { name: "Continuar análisis" }).waitFor();
  const activity = await window.locator(".welcome-strip").innerText();
  if (!activity.includes("detuvo")) throw new Error(`unexpected discovery activity: ${activity}`);
  console.log(JSON.stringify({ interruptedDiscoveryIsResumable: true, activity }, null, 2));
} finally {
  await app.close();
  if (originalMarker === null) await unlink(markerPath).catch(() => undefined);
  else await writeFile(markerPath, originalMarker, "utf8");
}
