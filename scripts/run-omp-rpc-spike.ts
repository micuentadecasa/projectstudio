import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { RpcClient } from "../packages/omp-bridge/src/rpc.js";

const root = process.cwd();
const sessionDirectory = join(root, ".tmp", "omp-sessions");
await mkdir(sessionDirectory, { recursive: true });
const client = new RpcClient();
const stderr: string[] = [];
client.on("stderr", (chunk: string) => stderr.push(chunk));

try {
  const command = process.env.OMP_BIN ?? "omp";
  const args = ["--mode", "rpc", "--session-dir", sessionDirectory, "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", root];
  const ready = await client.start(command, args, root);
  const negotiation = await client.request({ id: "protocol-1", type: "negotiate_protocol", protocolVersion: 2 });
  const state = await client.request({ id: "state-1", type: "get_state" });
  console.log(JSON.stringify({ mode: "real", executable: command, ready, negotiation, state, stderr }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ mode: "real", executable: process.env.OMP_BIN ?? "omp", status: "failed", error: error instanceof Error ? error.message : String(error), stderr }, null, 2));
  process.exitCode = 1;
} finally {
  await client.stop();
}
