import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RpcClient, RpcFrameDecoder } from "../packages/omp-bridge/src/rpc.js";

const root = process.cwd();
const emulator = join(root, "tests/fixtures/omp-rpc-emulator.mjs");

describe("OMP RPC Fase 00", () => {
  it("decodes a complete v2 chunk sequence without parsing partial JSON", () => {
    const decoder = new RpcFrameDecoder();
    const encoded = Buffer.from(JSON.stringify({ type: "message_update", delta: "á" }), "utf8");
    const parts = [encoded.subarray(0, 8), encoded.subarray(8)];
    const frames = parts.flatMap((part, index) => decoder.decodeLine(JSON.stringify({
      type: "rpc_chunk",
      chunkId: "chunk-1",
      index,
      count: parts.length,
      byteLength: encoded.byteLength,
      data: part.toString("base64"),
    })));
    expect(frames).toEqual([{ type: "message_update", delta: "á" }]);
  });

  it("covers ready, v2 negotiation, host tool, prompt result, settled and abort", async () => {
    const client = new RpcClient();
    const ready = await client.start(process.execPath, [emulator], root);
    expect(ready).toMatchObject({ type: "ready", supportedProtocolVersions: [1, 2] });

    await expect(client.request({ id: "protocol-1", type: "negotiate_protocol", protocolVersion: 2 })).resolves.toMatchObject({
      success: true,
      data: { protocolVersion: 2 },
    });
    await expect(client.request({ id: "state-1", type: "get_state" })).resolves.toMatchObject({ success: true });
    await expect(client.request({ id: "tools-1", type: "set_host_tools", tools: [{ name: "studio_task_progress" }] })).resolves.toMatchObject({ success: true });

    await client.request({ id: "prompt-1", type: "prompt", message: "fixture" });
    const toolCall = await client.waitFor((frame) => frame.type === "host_tool_call");
    expect(toolCall).toMatchObject({ name: "studio_task_progress", arguments: { step: "fixture" } });
    const promptResult = client.waitFor((frame) => frame.type === "prompt_result");
    const sessionSettled = client.waitFor((frame) => frame.type === "session_settled");
    client.send({ type: "host_tool_result", callId: toolCall.callId, result: { ok: true } });
    await expect(promptResult).resolves.toMatchObject({ status: "success" });
    await expect(sessionSettled).resolves.toMatchObject({ type: "session_settled" });

    client.send({ id: "abort-1", type: "abort" });
    await expect(client.waitFor((frame) => frame.type === "response" && frame.id === "abort-1")).resolves.toMatchObject({ success: true });
    await client.stop();
  });
});
