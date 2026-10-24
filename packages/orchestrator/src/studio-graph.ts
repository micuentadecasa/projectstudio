import { randomUUID } from "node:crypto";
import {
  Annotation,
  Command,
  END,
  interrupt,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

export type WorkflowKind = "navigate" | "inspection";
export type JobStatus = "queued" | "running" | "waiting-approval" | "completed" | "rejected";
export type GateStatus = "not-required" | "pending" | "approved" | "rejected";

export type AuditEntry = {
  eventId: string;
  runId: string;
  kind: string;
  message: string;
};

export type StudioRunContext = {
  projectId: string;
  threadId: string;
  runId: string;
  requestId: string;
};

export type WorkflowCommand =
  | { kind: "navigate"; targetId: string; view: "pdac" | "architecture" | "evidence" }
  | { kind: "inspection"; targetId: string; resource: "repository" | "project" };

const StudioGraphState = Annotation.Root({
  projectId: Annotation<string>(),
  threadId: Annotation<string>(),
  runId: Annotation<string>(),
  requestId: Annotation<string>(),
  commandKind: Annotation<WorkflowKind>(),
  targetId: Annotation<string>(),
  view: Annotation<string | undefined>(),
  resource: Annotation<string | undefined>(),
  jobStatus: Annotation<JobStatus>({ reducer: (_left, right) => right, default: () => "queued" }),
  gateStatus: Annotation<GateStatus>({ reducer: (_left, right) => right, default: () => "not-required" }),
  gateId: Annotation<string | undefined>(),
  result: Annotation<string | undefined>(),
  auditLog: Annotation<AuditEntry[]>({ reducer: (left, right) => left.concat(right), default: () => [] }),
});

export type StudioGraphStateValue = typeof StudioGraphState.State;

function audit(state: StudioGraphStateValue, kind: string, message: string): AuditEntry {
  return { eventId: randomUUID(), runId: state.runId, kind, message };
}
function readDecision(value: unknown): "approved" | "rejected" {
  if (value === "approved" || value === "rejected") return value;
  if (typeof value === "object" && value !== null && "decision" in value) {
    const decision = value.decision;
    if (decision === "approved" || decision === "rejected") return decision;
  }
  throw new Error("approval decision must be approved or rejected");
}

export function isGraphInterrupted(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("__interrupt__" in value)) return false;
  const interrupts = value.__interrupt__;
  return Array.isArray(interrupts) && interrupts.length > 0;
}


function buildGraph(checkpointer: SqliteSaver) {
  return new StateGraph(StudioGraphState)
    .addNode("route", (state) => ({
      jobStatus: (state.commandKind === "inspection" ? "waiting-approval" : "running") as JobStatus,
      auditLog: [audit(state, "workflow.started", `workflow ${state.commandKind} started`)],
    }))
    .addNode("navigate", (state) => ({
      jobStatus: "completed" as JobStatus,
      result: `view:${state.view ?? "unknown"}:${state.targetId}`,
      auditLog: [audit(state, "navigate.completed", `opened ${state.view ?? "unknown"}:${state.targetId}`)],
    }))
    .addNode("inspection_gate", (state) => {
      const response = interrupt({
        kind: "inspection-approval",
        gateId: state.gateId,
        projectId: state.projectId,
        targetId: state.targetId,
        resource: state.resource,
      });
      const decision = readDecision(response);
      return decision === "approved"
        ? {
            gateStatus: "approved" as GateStatus,
            jobStatus: "running" as JobStatus,
            auditLog: [audit(state, "gate.approved", `inspection approved for ${state.targetId}`)],
          }
        : {
            gateStatus: "rejected" as GateStatus,
            jobStatus: "rejected" as JobStatus,
            result: "inspection rejected",
            auditLog: [audit(state, "gate.rejected", `inspection rejected for ${state.targetId}`)],
          };
    })
    .addNode("inspection", (state) => ({
      jobStatus: "completed" as JobStatus,
      result: `inspected:${state.resource}:${state.targetId}`,
      auditLog: [audit(state, "inspection.completed", `inspection completed for ${state.targetId}`)],
    }))
    .addEdge(START, "route")
    .addConditionalEdges("route", (state) => state.commandKind, {
      navigate: "navigate",
      inspection: "inspection_gate",
    })
    .addConditionalEdges("inspection_gate", (state) => state.gateStatus, {
      approved: "inspection",
      rejected: END,
    })
    .addEdge("navigate", END)
    .addEdge("inspection", END)
    .compile({ checkpointer });
}

export class StudioGraphRuntime {
  private readonly graph: ReturnType<typeof buildGraph>;

  constructor(dbPath: string) {
    this.graph = buildGraph(SqliteSaver.fromConnString(dbPath));
  }

  async start(command: WorkflowCommand, context: StudioRunContext) {
    const input = command.kind === "navigate"
      ? {
          ...context,
          commandKind: "navigate" as const,
          targetId: command.targetId,
          view: command.view,
          gateStatus: "not-required" as GateStatus,
        }
      : {
          ...context,
          commandKind: "inspection" as const,
          targetId: command.targetId,
          resource: command.resource,
          gateStatus: "pending" as GateStatus,
          gateId: `gate-${context.runId}`,
        };
    return this.graph.invoke(input, this.config(context.threadId));
  }

  async resume(threadId: string, decision: "approved" | "rejected") {
    return this.graph.invoke(new Command({ resume: decision }), this.config(threadId));
  }

  async state(threadId: string) {
    return this.graph.getState(this.config(threadId));
  }

  private config(threadId: string) {
    return { configurable: { thread_id: threadId } };
  }
}
