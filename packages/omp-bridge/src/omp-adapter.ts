import { EventEmitter } from "node:events";
import { RpcClient, type RpcFrame } from "./rpc.js";

export type OmpStatus = "disconnected" | "starting" | "ready" | "submitting" | "streaming" | "tool-waiting" | "completing" | "aborting" | "settled" | "failed";
export type StreamingBehavior = "steer" | "follow_up";

export type HostToolCall = {
  callId: string;
  name: string;
  arguments: unknown;
};

export type HostTool = {
  name: string;
  description?: string;
  parameters?: unknown;
  handler: (call: HostToolCall) => Promise<unknown>;
};

export type OmpAdapterEvent =
  | { type: "status"; status: OmpStatus }
  | { type: "ready"; protocolVersion: number }
  | { type: "message_update"; frame: RpcFrame }
  | { type: "message_end"; frame: RpcFrame }
  | { type: "host_tool_call"; call: HostToolCall }
  | { type: "prompt_result"; frame: RpcFrame }
  | { type: "session_settled" }
  | { type: "queue_update"; frame: RpcFrame }
  | { type: "warning"; message: string }
  | { type: "error"; message: string };

export type OmpAdapterOptions = {
  command: string;
  args: string[];
  cwd: string;
  hostTools?: HostTool[];
  sessionKey: string;
  client?: RpcClient;
};

export type PromptAccepted = {
  requestId: string;
  command: "prompt" | "steer" | "follow_up";
  accepted: true;
};

function stringField(frame: RpcFrame, name: string): string | undefined {
  const value = frame[name];
  return typeof value === "string" ? value : undefined;
}

function numberField(frame: RpcFrame, name: string): number | undefined {
  const value = frame[name];
  return typeof value === "number" ? value : undefined;
}

function booleanField(frame: RpcFrame, name: string): boolean | undefined {
  const value = frame[name];
  return typeof value === "boolean" ? value : undefined;
}

export class OmpAdapter extends EventEmitter {
  private readonly client: RpcClient;
  private readonly options: OmpAdapterOptions;
  private readonly tools = new Map<string, HostTool>();
  private statusValue: OmpStatus = "disconnected";
  private protocolVersion = 1;

  constructor(options: OmpAdapterOptions) {
    super();
    this.options = options;
    this.client = options.client ?? new RpcClient();
    for (const tool of options.hostTools ?? []) this.tools.set(tool.name, tool);
    this.client.on("frame", (frame: RpcFrame) => void this.handleFrame(frame));
    this.client.on("stderr", (message: string) => this.emitEvent({ type: "warning", message: message.trim() }));
    this.client.on("exit", ({ code, signal }: { code: number | null; signal: string | null }) => {
      if (this.statusValue !== "disconnected") {
        this.setStatus(code === 0 ? "settled" : "failed");
        this.emitEvent({ type: "warning", message: `OMP exited with code=${code ?? "none"} signal=${signal ?? "none"}` });
      }
    });
  }

  get status(): OmpStatus {
    return this.statusValue;
  }

  get sessionKey(): string {
    return this.options.sessionKey;
  }

  get negotiatedProtocolVersion(): number {
    return this.protocolVersion;
  }

  async start(): Promise<void> {
    this.setStatus("starting");
    try {
      const ready = await this.client.start(this.options.command, this.options.args, this.options.cwd);
      const supported = Array.isArray(ready.supportedProtocolVersions)
        ? ready.supportedProtocolVersions.filter((value): value is number => typeof value === "number")
        : [];
      if (supported.includes(2)) {
        const negotiated = await this.client.request({ type: "negotiate_protocol", protocolVersion: 2 });
        if (!this.succeeded(negotiated)) throw new Error("OMP rejected RPC protocol v2");
        this.protocolVersion = 2;
      } else {
        this.protocolVersion = numberField(ready, "protocolVersion") ?? 1;
      }
      await this.requestRequiredState("get_state");
      await this.requestRequiredState("get_available_models");
      await this.requestRequiredState("get_available_commands");
      if (this.tools.size > 0) {
        await this.requestRequiredState("set_host_tools", {
          tools: [...this.tools.values()].map(({ name, description, parameters }) => ({ name, description, parameters })),
        });
      }
      this.emitEvent({ type: "ready", protocolVersion: this.protocolVersion });
      this.setStatus("ready");
    } catch (error) {
      this.setStatus("failed");
      this.emitEvent({ type: "error", message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async prompt(message: string, streamingBehavior?: StreamingBehavior): Promise<PromptAccepted> {
    const isStreaming = this.statusValue === "streaming" || this.statusValue === "tool-waiting";
    const commandType: "prompt" | "steer" | "follow_up" = isStreaming
      ? streamingBehavior === "steer" ? "steer" : "follow_up"
      : "prompt";
    if (!isStreaming && this.statusValue !== "ready" && this.statusValue !== "settled") {
      throw new Error(`cannot prompt while OMP status is ${this.statusValue}`);
    }
    this.setStatus(commandType === "prompt" ? "submitting" : "streaming");
    const response = await this.client.request({ type: commandType, message });
    if (!this.succeeded(response)) {
      this.setStatus("failed");
      throw new Error(stringField(response, "error") ?? `OMP rejected ${commandType}`);
    }
    this.setStatus("streaming");
    return { requestId: stringField(response, "id") ?? "", command: commandType, accepted: true };
  }

  async abort(): Promise<void> {
    if (this.statusValue !== "streaming" && this.statusValue !== "tool-waiting") return;
    this.setStatus("aborting");
    await this.requestRequiredState("abort");
  }

  async stop(): Promise<void> {
    await this.client.stop();
    this.setStatus("disconnected");
  }

  private async requestRequiredState(type: string, extra: Record<string, unknown> = {}): Promise<RpcFrame> {
    const response = await this.client.request({ type, ...extra });
    if (!this.succeeded(response)) throw new Error(stringField(response, "error") ?? `OMP rejected ${type}`);
    return response;
  }

  private async handleFrame(frame: RpcFrame): Promise<void> {
    switch (frame.type) {
      case "message_update":
        this.setStatus("streaming");
        this.emitEvent({ type: "message_update", frame });
        return;
      case "message_end":
        this.setStatus("completing");
        this.emitEvent({ type: "message_end", frame });
        return;
      case "host_tool_call":
        await this.handleHostTool(frame);
        return;
      case "prompt_result":
        this.setStatus(frame.sessionSettled === true ? "settled" : "completing");
        this.emitEvent({ type: "prompt_result", frame });
        return;
      case "session_settled":
        this.setStatus("settled");
        this.emitEvent({ type: "session_settled" });
        return;
      case "queue_update":
        this.emitEvent({ type: "queue_update", frame });
        return;
      default:
        return;
    }
  }

  private async handleHostTool(frame: RpcFrame): Promise<void> {
    const callId = stringField(frame, "callId");
    const name = stringField(frame, "name");
    if (!callId || !name) {
      this.emitEvent({ type: "error", message: "OMP host_tool_call missing callId or name" });
      return;
    }
    const call: HostToolCall = { callId, name, arguments: frame.arguments };
    this.setStatus("tool-waiting");
    this.emitEvent({ type: "host_tool_call", call });
    const tool = this.tools.get(name);
    if (!tool) {
      this.sendHostToolResult(callId, true, { code: "tool_not_allowed", message: `Tool not allowed: ${name}` });
      this.emitEvent({ type: "warning", message: `Tool not allowed: ${name}` });
      return;
    }
    try {
      const result = await tool.handler(call);
      this.sendHostToolResult(callId, false, result);
      this.setStatus("streaming");
    } catch (error) {
      this.sendHostToolResult(callId, true, { code: "host_tool_failed", message: error instanceof Error ? error.message : String(error) });
      this.emitEvent({ type: "error", message: `Host tool ${name} failed` });
    }
  }

  private sendHostToolResult(callId: string, isError: boolean, result: unknown): void {
    try {
      this.client.send({ type: "host_tool_result", callId, isError, result });
    } catch (error) {
      this.emitEvent({ type: "warning", message: `Could not answer host tool ${callId}: ${error instanceof Error ? error.message : String(error)}` });
    }
  }

  private succeeded(frame: RpcFrame): boolean {
    return booleanField(frame, "success") === true;
  }

  private setStatus(status: OmpStatus): void {
    this.statusValue = status;
    this.emitEvent({ type: "status", status });
  }

  private emitEvent(event: OmpAdapterEvent): void {
    this.emit("event", event);
    if (event.type === "error") {
      if (this.listenerCount("error") > 0) this.emit("error", event);
      else this.emit("adapter_error", event);
      return;
    }
    this.emit(event.type, event);
  }
}
