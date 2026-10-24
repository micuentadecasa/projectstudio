import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSqliteApprovalSpike } from "../packages/orchestrator/src/sqlite-spike.js";

describe("LangGraph.js + SQLite Fase 00", () => {
  it("persists an interrupt and resumes it through a fresh graph/checkpointer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "projectstudio-fase00-"));
    try {
      const result = await runSqliteApprovalSpike(join(directory, "spike.sqlite"), "thread-a");
      expect(result.first).toMatchObject({ interrupted: true, executions: 0, threadId: "thread-a" });
      expect(result.resumed).toMatchObject({ interrupted: false, decision: "approved", executions: 1, threadId: "thread-a" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
