import { randomUUID } from "node:crypto";
import {
  Annotation,
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";

export type AgentWorkflow = "brownfield-discovery" | "architecture-documentation" | "architecture-planning";

export type AgentCommand = {
  workflow: AgentWorkflow;
  prompt: string;
};

export type AgentRunContext = {
  projectId: string;
  threadId: string;
  runId: string;
  requestId: string;
};

export type OmpPromptGateway = {
  prompt: (message: string) => Promise<{ requestId: string; command: string; accepted: boolean }>;
};

type AgentState = {
  projectId: string;
  threadId: string;
  runId: string;
  requestId: string;
  workflow: AgentWorkflow;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed";
  ompRequestId: string | undefined;
  error: string | undefined;
};

const AgentState = Annotation.Root({
  projectId: Annotation<string>(),
  threadId: Annotation<string>(),
  runId: Annotation<string>(),
  requestId: Annotation<string>(),
  workflow: Annotation<AgentWorkflow>(),
  prompt: Annotation<string>(),
  status: Annotation<AgentState["status"]>({ reducer: (_left, right) => right, default: () => "queued" }),
  ompRequestId: Annotation<string | undefined>(),
  error: Annotation<string | undefined>(),
});

function promptForAgent(state: AgentState): string {
  return [
    "Identidad: eres el Arquitecto de Proyecto de ProjectStudio, un acompañante técnico pragmático para product managers y equipos de IT.",
    "Misión: convertir un repositorio y sus decisiones en documentación útil, arquitectura trazable y siguientes pasos ejecutables, sin sustituir el criterio del usuario.",
    `Flujo autorizado: ${state.workflow}.`,
    "Personalidad: curioso pero no invasivo, claro, honesto con la incertidumbre, orientado a decisiones y respetuoso del tiempo y del presupuesto.",
    "Comportamiento: empieza por evidencia barata y reversible; separa hechos, inferencias e incógnitas; propone una siguiente acción concreta; si falta una decisión importante, formula una sola pregunta breve y ofrece una opción segura para continuar.",
    "El host controla permisos y publicación; no ejecutes cambios externos ni inventes artefactos.",
    "Distingue hechos observados, inferencias e incógnitas. Cita rutas o evidencias verificables.",
    "No muestres al usuario el protocolo RPC, herramientas, checkpoints, estados internos ni pasos de razonamiento.",
    "Responde en español con un resumen breve de máximo 5 puntos, seguido sólo de decisiones, riesgos y próximos pasos útiles.",
    state.workflow === "architecture-planning"
      ? "La salida es una propuesta aislada de Architecture Lab; no alteres la arquitectura aceptada ni el código.":
      "Publica primero hallazgos verificables y después una propuesta de vista si procede.",
    `Solicitud del usuario: ${state.prompt}`,
  ].join("\n");
}

function buildAgentGraph(gateway: OmpPromptGateway, checkpointer: SqliteSaver) {
  return new StateGraph(AgentState)
    .addNode("resolve_intent", (state) => ({ status: "running" as const, prompt: promptForAgent(state) }))
    .addNode("invoke_omp", async (state) => {
      const accepted = await gateway.prompt(state.prompt);
      return {
        status: accepted.accepted ? "completed" as const : "failed" as const,
        ompRequestId: accepted.requestId,
      };
    })
    .addEdge(START, "resolve_intent")
    .addEdge("resolve_intent", "invoke_omp")
    .addEdge("invoke_omp", END)
    .compile({ checkpointer });
}

export class StudioAgentRuntime {
  private readonly graph: ReturnType<typeof buildAgentGraph>;

  constructor(dbPath: string, gateway: OmpPromptGateway) {
    this.graph = buildAgentGraph(gateway, SqliteSaver.fromConnString(dbPath));
  }

  async start(command: AgentCommand, context: AgentRunContext) {
    return this.graph.invoke({ ...context, ...command, status: "queued" }, { configurable: { thread_id: context.threadId } });
  }

  static newContext(projectId: string, threadId: string): AgentRunContext {
    return { projectId, threadId, runId: randomUUID(), requestId: randomUUID() };
  }
}
