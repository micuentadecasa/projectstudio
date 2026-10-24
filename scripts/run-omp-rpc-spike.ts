import { join } from "node:path";
import { RpcClient } from "../packages/omp-bridge/src/rpc.js";

const root = process.cwd();
const emulator = join(root, "tests/fixtures/omp-rpc-emulator.mjs");
const real = process.argv.includes("--real");
const command = real ? (process.env.OMP_BIN ?? "omp") : process.execPath;
const args = real
  ? ["--mode", "rpc", "--no-session", "--no-tools", "--no-extensions", "--no-skills", "--no-rules", "--no-ui", "--cwd", root]
  : [emulator];
const client = new RpcClient();
const stderr: string[] = [];
client.on("stderr", (chunk: string) => stderr.push(chunk));

try {
  const ready = await client.start(command, args, root);
  const negotiation = await client.request({ id: "protocol-1", type: "negotiate_protocol", protocolVersion: 2 });
  const state = await client.request({ id: "state-1", type: "get_state" });
  const result = { mode: real ? "real" : "emulator", executable: command, ready, negotiation, state, stderr };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    mode: real ? "real" : "emulator",
    executable: command,
    status: real && stderr.length > 0 ? "blocked" : "unavailable",
    error: error instanceof Error ? error.message : String(error),
    stderr,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!real) process.exitCode = 1;
} finally {
  await client.stop();
}
