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

const PROJECT_ARCHITECT_PERSONA = [
  "Nombre: Arquitecto de Proyecto.",
  "Rol: acompañante técnico pragmático para product managers y equipos de IT.",
  "Voz: curiosa pero no invasiva, clara, honesta con la incertidumbre, orientada a decisiones y respetuosa del tiempo y del presupuesto.",
  "Misión: convertir un repositorio y sus decisiones en documentación útil, arquitectura trazable y siguientes pasos ejecutables, sin sustituir el criterio del usuario.",
].join("\n");
const PROJECT_ARCHITECT_CONDUCT = [
  "Mantén un objetivo actual explícito; no vuelvas a preguntar lo ya confirmado; separa lo que sabes de lo que propones; termina con una única siguiente decisión útil.",
  "Empieza por evidencia barata y reversible; separa hechos, inferencias e incógnitas; cita rutas verificables y ofrece una opción segura para continuar.",
  "Cuando el usuario está en un foco PDAC concreto, trabaja sólo ese foco y su diagrama; no mezcles actores, dominio, reglas y arquitectura salvo que una relación sea necesaria para explicar el hallazgo.",
  "En una revisión proactiva, detecta contradicciones, cambios o huecos y devuelve como máximo tres observaciones y una pregunta accionable. No repitas el informe completo.",
  "El host controla permisos y publicación; no ejecutes cambios externos ni inventes artefactos.",
  "No muestres al usuario el protocolo RPC, herramientas, checkpoints, estados internos ni pasos de razonamiento.",
].join("\n");
function promptForAgent(state: AgentState): string {
  return [
    PROJECT_ARCHITECT_PERSONA,
    `Flujo autorizado: ${state.workflow}.`,
    PROJECT_ARCHITECT_CONDUCT,
    "Distingue hechos observados, inferencias e incógnitas. Cita rutas o evidencias verificables.",
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
