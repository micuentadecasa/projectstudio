import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isGraphInterrupted, StudioGraphRuntime, type StudioRunContext } from "../packages/orchestrator/src/studio-graph.js";

const context: StudioRunContext = {
  projectId: "project-demo",
  threadId: "thread-f02",
  runId: "run-f02-001",
  requestId: "request-f02-001",
};

describe("StudioGraphRuntime Fase 02", () => {
  it("completes navigate and persists the result by thread/run", async () => {
    const directory = await mkdtemp(join(tmpdir(), "projectstudio-f02-navigate-"));
    try {
      const runtime = new StudioGraphRuntime(join(directory, "graph.sqlite"));
      const result = await runtime.start({ kind: "navigate", targetId: "UC-002", view: "pdac" }, context);
      expect(result).toMatchObject({
        projectId: context.projectId,
        threadId: context.threadId,
        runId: context.runId,
        jobStatus: "completed",
        result: "view:pdac:UC-002",
      });

      const reopened = new StudioGraphRuntime(join(directory, "graph.sqlite"));
      const snapshot = await reopened.state(context.threadId);
      expect(snapshot.values).toMatchObject({
        runId: context.runId,
        jobStatus: "completed",
        result: "view:pdac:UC-002",
      });
      expect(snapshot.values.auditLog).toHaveLength(2);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("persists an inspection interrupt and resumes approval after reopening", async () => {
    const directory = await mkdtemp(join(tmpdir(), "projectstudio-f02-approval-"));
    try {
      const runtime = new StudioGraphRuntime(join(directory, "graph.sqlite"));
      const interrupted = await runtime.start(
        { kind: "inspection", targetId: "repo-demo", resource: "repository" },
        { ...context, threadId: "thread-approval", runId: "run-approval" },
      );
      expect(isGraphInterrupted(interrupted)).toBe(true);

      const reopened = new StudioGraphRuntime(join(directory, "graph.sqlite"));
      const checkpoint = await reopened.state("thread-approval");
      expect(checkpoint.values).toMatchObject({
        runId: "run-approval",
        jobStatus: "waiting-approval",
        gateStatus: "pending",
      });

      const resumed = await reopened.resume("thread-approval", "approved");
      expect(resumed).toMatchObject({
        runId: "run-approval",
        jobStatus: "completed",
        result: "inspected:repository:repo-demo",
      });
      expect(resumed.auditLog).toHaveLength(3);
      expect(resumed.auditLog.map((entry) => entry.kind)).toEqual([
        "workflow.started",
        "gate.approved",
        "inspection.completed",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("persists rejection and never enters the inspection node", async () => {
    const directory = await mkdtemp(join(tmpdir(), "projectstudio-f02-rejection-"));
    try {
      const runtime = new StudioGraphRuntime(join(directory, "graph.sqlite"));
      await runtime.start(
        { kind: "inspection", targetId: "project-demo", resource: "project" },
        { ...context, threadId: "thread-rejection", runId: "run-rejection" },
      );
      const result = await runtime.resume("thread-rejection", "rejected");
      expect(result).toMatchObject({ jobStatus: "rejected", result: "inspection rejected" });
      expect(result.auditLog.map((entry) => entry.kind)).toEqual(["workflow.started", "gate.rejected"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
