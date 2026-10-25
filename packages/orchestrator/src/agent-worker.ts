import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { OmpAdapter, type OmpAdapterEvent } from "../../omp-bridge/src/omp-adapter.js";
import { StudioAgentRuntime, type AgentCommand, type AgentRunContext } from "./agent-runtime.js";
import { textDeltaFromFrame, textFromFrame } from "./omp-frame-text.js";

type StartRequest = { type: "start"; id: string; command: AgentCommand; context: AgentRunContext };
type ChatStartRequest = { type: "chat_start"; id: string };
type WorkerMessage = StartRequest | ChatStartRequest;

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const workspaceRoot = process.env.PROJECTSTUDIO_WORKSPACE_ROOT ?? process.cwd();
const projectRoot = process.env.PROJECTSTUDIO_PROJECT_ROOT ?? workspaceRoot;
const sessionDirectory = join(workspaceRoot, ".tmp", "omp-sessions");
mkdirSync(sessionDirectory, { recursive: true });
let adapter: OmpAdapter | undefined;
let adapterStart: Promise<void> | undefined;
let responseText = "";

function getAdapter(): OmpAdapter {
  if (adapter) return adapter;
  adapter = new OmpAdapter({
    command: process.env.OMP_BIN ?? "omp",
    args: ["--mode", "rpc", "--session-dir", sessionDirectory, "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", projectRoot],
    cwd: projectRoot,
    sessionKey: `${projectRoot}/thread-main`,
    hostTools: [{
      name: "studio_task_progress",
      description: "Registra progreso interno de una tarea de ProjectStudio.",
      parameters: { type: "object", properties: { step: { type: "string" } }, additionalProperties: false },
      handler: async () => ({ accepted: true }),
    }],
  });
  adapter.on("event", (event: OmpAdapterEvent) => {
    if (event.type === "message_update") {
      const delta = textDeltaFromFrame(event.frame);
      if (delta) {
        responseText += delta;
        send({ type: "event", event: { type: "message_update", frame: { assistantMessageEvent: { type: "text_delta", delta } } } });
      }
      return;
    }
    if (event.type === "message_end") {
      const text = textFromFrame(event.frame);
      if (text) responseText = text;
      return;
    }
    if (event.type === "prompt_result") {
      const text = textFromFrame(event.frame);
      if (text) responseText = text;
      return;
    }
    if (event.type === "session_settled") {
      send({ type: "event", event: { type: "message_end", frame: { text: responseText } } });
      responseText = "";
      send({ type: "event", event: { type: "session_settled" } });
      return;
    }
    if (event.type === "status" || event.type === "ready" || event.type === "warning" || event.type === "error") {
      if (event.type === "status" && event.status === "settled") return;
      send({ type: "event", event });
    }
  });
  return adapter;
}

async function startChat(): Promise<{ status: string }> {
  const current = getAdapter();
  if (!adapterStart) adapterStart = current.start();
  await adapterStart;
  return { status: current.status };
}

const runtime = new StudioAgentRuntime(process.env.PROJECTSTUDIO_AGENT_DB ?? "projectstudio-agent.sqlite", {
  prompt: (message) => getAdapter().prompt(message),
});
let shuttingDown = false;
async function shutdownWorker(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await adapter?.stop();
  } finally {
    process.exit(0);
  }
}
process.once("SIGTERM", () => { void shutdownWorker(); });
const input = createInterface({ input: process.stdin });
input.on("close", () => { void shutdownWorker(); });
const parentPid = Number(process.env.PROJECTSTUDIO_PARENT_PID);
if (Number.isInteger(parentPid) && parentPid > 0) {
  const parentWatch = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      void shutdownWorker();
    }
  }, 500);
  parentWatch.unref();
}
input.on("line", (line) => {
  let message: WorkerMessage;
  try {
    message = JSON.parse(line) as WorkerMessage;
  } catch {
    send({ type: "error", error: "worker received invalid JSON" });
    return;
  }
  if (message.type === "chat_start") {
    void startChat()
      .then((result) => send({ type: "chat_result", id: message.id, result }))
      .catch((error: unknown) => send({ type: "chat_result", id: message.id, error: error instanceof Error ? error.message : String(error) }));
    return;
  }
  void startChat()
    .then(() => runtime.start(message.command, message.context))
    .then((state) => send({ type: "result", id: message.id, result: { status: state.status, ompRequestId: state.ompRequestId } }))
    .catch((error: unknown) => send({ type: "result", id: message.id, error: error instanceof Error ? error.message : String(error) }));
});
