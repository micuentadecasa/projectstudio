import { Command, END, interrupt, START, StateGraph, Annotation } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

const SpikeState = Annotation.Root({
  input: Annotation<string>(),
  decision: Annotation<string | undefined>(),
  executions: Annotation<number>({ reducer: (left, right) => left + right, default: () => 0 }),
});

type SpikeResult = {
  interrupted: boolean;
  decision?: string;
  executions: number;
  threadId: string;
};

function hasInterrupt(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("__interrupt__" in value)) return false;
  const interrupts = value.__interrupt__;
  return Array.isArray(interrupts) && interrupts.length > 0;
}

function readDecision(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("decision" in value)) return undefined;
  const decision = value.decision;
  return typeof decision === "string" ? decision : undefined;
}

function buildGraph(checkpointer: SqliteSaver) {
  return new StateGraph(SpikeState)
    .addNode("approval", (state) => {
      const decision = interrupt({
        kind: "phase-00-spike-approval",
        input: state.input,
      }) as string;
      return { decision, executions: 1 };
    })
    .addEdge(START, "approval")
    .addEdge("approval", END)
    .compile({ checkpointer });
}

export async function runSqliteApprovalSpike(dbPath: string, threadId: string): Promise<{ first: SpikeResult; resumed: SpikeResult }> {
  const initialGraph = buildGraph(SqliteSaver.fromConnString(dbPath));
  const config = { configurable: { thread_id: threadId } };
  const first = await initialGraph.invoke({ input: "approve phase 00", executions: 0 }, config);
  const resumedGraph = buildGraph(SqliteSaver.fromConnString(dbPath));
  const resumed = await resumedGraph.invoke(new Command({ resume: "approved" }), config);
  const decision = readDecision(resumed);
  return {
    first: {
      interrupted: hasInterrupt(first),
      executions: first.executions,
      threadId,
    },
    resumed: {
      interrupted: hasInterrupt(resumed),
      ...(decision === undefined ? {} : { decision }),
      executions: resumed.executions,
      threadId,
    },
  };
}
