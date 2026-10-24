import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { OmpAdapter, type OmpAdapterEvent } from "../packages/omp-bridge/src/omp-adapter.js";

const projectRoot = resolve(process.env.PROJECTSTUDIO_NOTES_ROOT ?? "/Users/luis/projects/notes");
const workspaceRoot = process.cwd();
const sessionDirectory = join(workspaceRoot, ".tmp", "omp-sessions");
const evidenceDirectory = join(workspaceRoot, "docs", "implementation", "evidence");
await mkdir(sessionDirectory, { recursive: true });
await mkdir(evidenceDirectory, { recursive: true });

const events: OmpAdapterEvent[] = [];
const adapter = new OmpAdapter({
  command: process.env.OMP_BIN ?? "omp",
  args: ["--mode", "rpc", "--session-dir", sessionDirectory, "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", projectRoot],
  cwd: projectRoot,
  sessionKey: "notes/productshape-cli",
  hostTools: [{
    name: "studio_task_progress",
    description: "Registra progreso interno de una tarea de ProjectStudio.",
    parameters: { type: "object", properties: { step: { type: "string" } }, additionalProperties: false },
    handler: async () => ({ accepted: true }),
  }],
});
adapter.on("event", (event: OmpAdapterEvent) => events.push(event));

function visibleText(event: OmpAdapterEvent): string {
  if (event.type !== "message_update") return "";
  const nested = event.frame.assistantMessageEvent;
  if (typeof nested !== "object" || nested === null) return "";
  const frame = nested as Record<string, unknown>;
  return frame.type === "text_delta" && typeof frame.delta === "string" ? frame.delta : "";
}

try {
  await adapter.start();
  const settled = Promise.withResolvers<void>();
  adapter.once("session_settled", () => settled.resolve());
  await adapter.prompt("PRODUCTSHAPE: analiza el producto usando primero docs/product y después el código para corroborar. Extrae propósito, actores, casos de uso, bounded contexts, reglas y restricciones. Devuelve hallazgos con rutas verificables y un único bloque Mermaid flowchart LR confirmado. No inventes componentes.");
  await settled.promise;

  const response = events.map(visibleText).join("");
  const mermaid = response.match(/```mermaid\s*\n([\s\S]*?)```/i)?.[1]?.trim() ?? "";
  if (!response || !mermaid) throw new Error("OMP no devolvió una respuesta ProductShape con un bloque Mermaid");

  const responsePath = join(evidenceDirectory, "F05-T01-notes-productshape-cli.md");
  const mermaidPath = join(evidenceDirectory, "F05-T01-notes-productshape-cli.mermaid");
  await writeFile(responsePath, `${response}\n`, "utf8");
  await writeFile(mermaidPath, `${mermaid}\n`, "utf8");
  console.log(JSON.stringify({ mode: "real", projectRoot, status: adapter.status, protocolVersion: adapter.negotiatedProtocolVersion, responsePath, mermaidPath, responseLength: response.length, mermaidLength: mermaid.length }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ mode: "real", projectRoot, status: "failed", error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await adapter.stop();
}
