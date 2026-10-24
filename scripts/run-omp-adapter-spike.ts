import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { OmpAdapter, type OmpAdapterEvent } from "../packages/omp-bridge/src/omp-adapter.js";

const root = process.cwd();
const real = process.argv.includes("--real");
const sessionDirectory = join(root, ".tmp", "omp-sessions");
await mkdir(sessionDirectory, { recursive: true });
const command = real ? (process.env.OMP_BIN ?? "omp") : process.execPath;
const args = real
  ? ["--mode", "rpc", "--profile", "projectstudio-phase03", "--session-dir", sessionDirectory, "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", root]
  : [join(root, "tests/fixtures/omp-rpc-emulator.mjs")];
const events: OmpAdapterEvent[] = [];
const adapter = new OmpAdapter({
  command,
  args,
  cwd: root,
  sessionKey: "project-demo/thread-f03",
  hostTools: [{ name: "studio_task_progress", handler: async () => ({ accepted: true }) }],
});
adapter.on("event", (event: OmpAdapterEvent) => events.push(event));

try {
  await adapter.start();
  const settled = Promise.withResolvers<void>();
  adapter.once("session_settled", () => settled.resolve());
  await adapter.prompt("analiza el proyecto");
  await settled.promise;
  console.log(JSON.stringify({ mode: real ? "real" : "emulator", status: adapter.status, protocolVersion: adapter.negotiatedProtocolVersion, events: events.map((event) => event.type), warnings: events.filter((event) => event.type === "warning").map((event) => event.message) }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ mode: real ? "real" : "emulator", status: real ? "blocked" : "failed", error: error instanceof Error ? error.message : String(error), events: events.map((event) => event.type), warnings: events.filter((event) => event.type === "warning").map((event) => event.message) }, null, 2));
  if (!real) process.exitCode = 1;
} finally {
  await adapter.stop();
}
