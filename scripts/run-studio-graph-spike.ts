import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isGraphInterrupted, StudioGraphRuntime } from "../packages/orchestrator/src/studio-graph.js";

const directory = join(tmpdir(), "projectstudio-fase02");
await mkdir(directory, { recursive: true });
const dbPath = join(directory, "studio.sqlite");
await rm(dbPath, { force: true });

const context = {
  projectId: "project-demo",
  threadId: "f02-inspection",
  runId: "run-f02-smoke",
  requestId: "request-f02-smoke",
};
const runtime = new StudioGraphRuntime(dbPath);
const pending = await runtime.start({ kind: "inspection", targetId: "repo-demo", resource: "repository" }, context);
const reopenedRuntime = new StudioGraphRuntime(dbPath);
const checkpoint = await reopenedRuntime.state(context.threadId);
const approved = await reopenedRuntime.resume(context.threadId, "approved");

console.log(JSON.stringify({
  dbPath,
  pending: {
    interrupted: isGraphInterrupted(pending),
    runId: checkpoint.values.runId,
    jobStatus: checkpoint.values.jobStatus,
    gateStatus: checkpoint.values.gateStatus,
  },
  approved: {
    runId: approved.runId,
    jobStatus: approved.jobStatus,
    result: approved.result,
    auditKinds: approved.auditLog.map((entry) => entry.kind),
  },
}, null, 2));
