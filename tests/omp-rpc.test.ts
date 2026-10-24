import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RpcClient, RpcFrameDecoder } from "../packages/omp-bridge/src/rpc.js";

const root = process.cwd();
const sessionDirectory = join(root, ".tmp", "omp-test-sessions");

describe("OMP RPC real", () => {
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

  it("starts the installed OMP, negotiates v2, and reads real state", async () => {
    await mkdir(sessionDirectory, { recursive: true });
    const client = new RpcClient();
    const command = process.env.OMP_BIN ?? "omp";
    const args = ["--mode", "rpc", "--session-dir", sessionDirectory, "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", root];
    try {
      const ready = await client.start(command, args, root);
      expect(ready).toMatchObject({ type: "ready", supportedProtocolVersions: expect.arrayContaining([2]) });
      await expect(client.request({ id: "protocol-real", type: "negotiate_protocol", protocolVersion: 2 })).resolves.toMatchObject({ success: true, data: { protocolVersion: 2 } });
      await expect(client.request({ id: "state-real", type: "get_state" })).resolves.toMatchObject({ success: true });
    } finally {
      await client.stop();
    }
  }, 60_000);
});
