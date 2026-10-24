/* global process, setTimeout */
import readline from "node:readline";

const rl = readline.createInterface({ input: process.stdin });
let protocolVersion = 1;
let hostToolCallId = 0;

const send = (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`);
send({ type: "ready", protocolVersion: 1, supportedProtocolVersions: [1, 2], maxFrameBytes: 1024, maxReassembledFrameBytes: 4096 });

rl.on("line", (line) => {
  const command = JSON.parse(line);
  if (command.type === "negotiate_protocol") {
    protocolVersion = command.protocolVersion;
    send({ id: command.id, type: "response", command: command.type, success: true, data: { protocolVersion } });
    return;
  }
  if (command.type === "set_host_tools") {
    send({ id: command.id, type: "response", command: command.type, success: true, data: { count: command.tools?.length ?? 0 } });
    return;
  }
  if (command.type === "get_state") {
    send({ id: command.id, type: "response", command: command.type, success: true, data: { status: "ready", protocolVersion } });
    return;
  }
  if (command.type === "prompt") {
    send({ id: command.id, type: "response", command: command.type, success: true, data: { agentInvoked: true } });
    const callId = `tool-${++hostToolCallId}`;
    setTimeout(() => send({ type: "message_update", messageId: "m-1", delta: "fixture" }), 1);
    setTimeout(() => send({ type: "host_tool_call", callId, name: "studio_task_progress", arguments: { step: "fixture" } }), 2);
    return;
  }
  if (command.type === "host_tool_result") {
    send({ type: "message_end", messageId: "m-1", text: "fixture complete" });
    send({ type: "prompt_result", id: "prompt-1", agentInvoked: true, status: "success", sessionSettled: true });
    send({ type: "session_settled" });
    return;
  }
  if (command.type === "abort") {
    send({ id: command.id, type: "response", command: command.type, success: true, data: { aborted: true } });
    send({ type: "prompt_result", id: "abort-prompt", agentInvoked: true, status: "aborted", sessionSettled: true });
    send({ type: "session_settled" });
    return;
  }
  send({ id: command.id, type: "response", command: command.type, success: false, error: `unsupported command ${command.type}` });
});
