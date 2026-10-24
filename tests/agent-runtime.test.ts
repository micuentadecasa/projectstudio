import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { StudioAgentRuntime } from "../packages/orchestrator/src/agent-runtime.js";

describe("runtime de agentes ProjectStudio", () => {
  it("resuelve el workflow y llama OMP desde un nodo LangGraph", async () => {
    const prompts: string[] = [];
    const runtime = new StudioAgentRuntime(join(tmpdir(), `projectstudio-agent-${randomUUID()}.sqlite`), {
      prompt: async (message) => {
        prompts.push(message);
        return { requestId: "omp-request-1", command: "prompt", accepted: true };
      },
    });

    const state = await runtime.start(
      { workflow: "architecture-planning", prompt: "Compara una arquitectura local con AWS para el proyecto." },
      { projectId: "notes", threadId: `notes/thread-${randomUUID()}`, runId: randomUUID(), requestId: randomUUID() },
    );

    expect(state.status).toBe("completed");
    expect(prompts[0]).toContain("Arquitecto de Proyecto de ProjectStudio");
    expect(prompts[0]).toContain("product managers y equipos de IT");
    expect(prompts[0]).toContain("formula una sola pregunta breve");
    expect(prompts[0]).toContain("propuesta aislada de Architecture Lab");
    expect(prompts[0]).toContain("No muestres al usuario el protocolo RPC");
    expect(prompts[0]).toContain("resumen breve de máximo 5 puntos");
});
});
