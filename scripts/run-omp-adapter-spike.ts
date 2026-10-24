import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { OmpAdapter, type OmpAdapterEvent } from "../packages/omp-bridge/src/omp-adapter.js";

const root = process.cwd();
const sessionDirectory = join(root, ".tmp", "omp-sessions");
await mkdir(sessionDirectory, { recursive: true });
const events: OmpAdapterEvent[] = [];
const adapter = new OmpAdapter({
  command: process.env.OMP_BIN ?? "omp",
  args: ["--mode", "rpc", "--session-dir", sessionDirectory, "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", root],
  cwd: root,
  sessionKey: "projectstudio/thread-spike",
  hostTools: [{
    name: "studio_task_progress",
    description: "Registra progreso interno de una tarea de ProjectStudio.",
    parameters: { type: "object", properties: { step: { type: "string" } }, additionalProperties: false },
    handler: async () => ({ accepted: true }),
  }],
});
adapter.on("event", (event: OmpAdapterEvent) => events.push(event));

try {
  await adapter.start();
  const settled = Promise.withResolvers<void>();
  adapter.once("session_settled", () => settled.resolve());
  await adapter.prompt("Responde exclusivamente con OMP_SPIKE_OK y no uses herramientas.");
  await settled.promise;
  console.log(JSON.stringify({ mode: "real", status: adapter.status, protocolVersion: adapter.negotiatedProtocolVersion, events: events.map((event) => event.type), warnings: events.filter((event) => event.type === "warning").map((event) => event.message) }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ mode: "real", status: "failed", error: error instanceof Error ? error.message : String(error), events: events.map((event) => event.type) }, null, 2));
  process.exitCode = 1;
} finally {
  await adapter.stop();
}
