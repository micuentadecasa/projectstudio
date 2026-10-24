import { describe, expect, it } from "vitest";
import { StudioEnvelopeSchema, StudioGraphStateSchema, ViewCommandSchema } from "../packages/contracts/src/index.js";

describe("contratos ProjectStudio Fase 00", () => {
  it("accepts an envelope with project-scoped sequencing", () => {
    const result = StudioEnvelopeSchema.parse({
      schemaVersion: 1,
      eventId: "event-1",
      projectId: "project-a",
      requestId: "request-1",
      correlationId: "correlation-1",
      emittedAt: "2026-10-24T00:00:00.000Z",
      sequence: 1,
      origin: "system",
      type: "activity.updated",
      payload: { status: "running" },
    });
    expect(result.projectId).toBe("project-a");
  });

  it("rejects arbitrary view command kinds", () => {
    expect(() => ViewCommandSchema.parse({ type: "view.open", viewId: "v1", kind: "html" })).toThrow();
  });

  it("keeps graph state fields explicit", () => {
    const result = StudioGraphStateSchema.parse({
      projectId: "project-a",
      threadId: "thread-a",
      runId: "run-a",
      requestId: "request-a",
      mode: "navigate",
      jobStatus: "queued",
      userIntent: "open",
      selection: { artifactIds: [], semanticIds: [], repoIds: [] },
      omp: { status: "idle" },
      proposals: [],
      artifactIds: [],
      gate: { status: "not-required" },
      budget: { timeoutMs: 10_000 },
      errors: [],
    });
    expect(result.gate.status).toBe("not-required");
  });
});
