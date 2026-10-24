import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OmpAdapter, type OmpAdapterEvent } from "../packages/omp-bridge/src/omp-adapter.js";

const root = process.cwd();
const emulator = join(root, "tests/fixtures/omp-rpc-emulator.mjs");

describe("OmpAdapter Fase 03", () => {
  it("negotiates v2, streams, executes a host tool, and handles follow_up", async () => {
    const events: OmpAdapterEvent[] = [];
    const toolCalls: string[] = [];
    const adapter = new OmpAdapter({
      command: process.execPath,
      args: [emulator],
      cwd: root,
      sessionKey: "project-demo/thread-omp",
      hostTools: [{
        name: "studio_task_progress",
        description: "records progress",
        parameters: { type: "object" },
        handler: async (call) => {
          toolCalls.push(call.name);
          return { accepted: true };
        },
      }],
    });
    adapter.on("event", (event: OmpAdapterEvent) => events.push(event));
    const settled = Promise.withResolvers<void>();
    adapter.once("session_settled", () => settled.resolve());

    await adapter.start();
    expect(adapter.status).toBe("ready");
    expect(adapter.negotiatedProtocolVersion).toBe(2);
    expect(adapter.sessionKey).toBe("project-demo/thread-omp");

    const accepted = await adapter.prompt("analiza el proyecto");
    expect(accepted).toMatchObject({ command: "prompt", accepted: true });

    const queued = Promise.withResolvers<OmpAdapterEvent>();
    adapter.once("queue_update", (event: OmpAdapterEvent) => queued.resolve(event));
    await expect(adapter.prompt("continúa", "follow_up")).resolves.toMatchObject({ command: "follow_up", accepted: true });
    await expect(queued.promise).resolves.toMatchObject({ type: "queue_update" });
    await settled.promise;

    expect(toolCalls).toEqual(["studio_task_progress"]);
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      "ready",
      "message_update",
      "message_end",
      "host_tool_call",
      "prompt_result",
      "session_settled",
      "queue_update",
    ]));
    await adapter.stop();
    expect(adapter.status).toBe("disconnected");
  });

  it("uses steer while streaming and aborts the active turn", async () => {
    const adapter = new OmpAdapter({
      command: process.execPath,
      args: [emulator],
      cwd: root,
      sessionKey: "project-demo/steer",
      hostTools: [{ name: "studio_task_progress", handler: async () => ({ ok: true }) }],
    });
    await adapter.start();
    await adapter.prompt("inicio");
    await expect(adapter.prompt("corrige el rumbo", "steer")).resolves.toMatchObject({ command: "steer", accepted: true });
    await expect(adapter.abort()).resolves.toBeUndefined();
    await adapter.stop();
  });
});
