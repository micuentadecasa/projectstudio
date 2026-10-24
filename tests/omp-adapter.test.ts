import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OmpAdapter, type OmpAdapterEvent } from "../packages/omp-bridge/src/omp-adapter.js";

const root = process.cwd();
const sessionDirectory = join(root, ".tmp", "omp-test-sessions");

function createRealAdapter(sessionKey: string): OmpAdapter {
  return new OmpAdapter({
    command: process.env.OMP_BIN ?? "omp",
    args: ["--mode", "rpc", "--session-dir", sessionDirectory, "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", root],
    cwd: root,
    sessionKey,
    hostTools: [{
      name: "studio_task_progress",
      description: "Registra progreso interno de una tarea de ProjectStudio.",
      parameters: { type: "object", properties: { step: { type: "string" } }, additionalProperties: false },
      handler: async () => ({ accepted: true }),
    }],
  });
}

describe("OmpAdapter con OMP real", () => {
  it("negocia v2 y completa un turno de texto real", async () => {
    await mkdir(sessionDirectory, { recursive: true });
    const events: OmpAdapterEvent[] = [];
    const adapter = createRealAdapter("projectstudio/test-adapter");
    const settled = Promise.withResolvers<void>();
    adapter.on("event", (event: OmpAdapterEvent) => {
      events.push(event);
      if (event.type === "session_settled") settled.resolve();
    });

    await adapter.start();
    expect(adapter.status).toBe("ready");
    expect(adapter.negotiatedProtocolVersion).toBe(2);
    await expect(adapter.prompt("Responde exclusivamente con OMP_REAL_TEST_OK y no uses herramientas.")).resolves.toMatchObject({ command: "prompt", accepted: true });
    await settled.promise;

    const text = events
      .filter((event): event is Extract<OmpAdapterEvent, { type: "message_update" }> => event.type === "message_update")
      .map((event) => {
        const nested = event.frame.assistantMessageEvent;
        if (typeof nested !== "object" || nested === null) return "";
        const nestedFrame = nested as Record<string, unknown>;
        return typeof nestedFrame.delta === "string" ? nestedFrame.delta : "";
      })
      .join("");
    expect(text).toContain("OMP_REAL_TEST_OK");
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(["ready", "message_update", "message_end", "prompt_result", "session_settled"]));

    await adapter.stop();
    expect(adapter.status).toBe("disconnected");
  }, 180_000);
});
