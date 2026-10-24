import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { TextDecoder } from "node:util";

export type RpcFrame = Record<string, unknown>;
export type RpcCommand = Record<string, unknown> & { type: string; id?: string };

type ChunkState = {
  chunkId: string;
  count: number;
  nextIndex: number;
  byteLength: number;
  bytes: Buffer[];
};

export class RpcFrameDecoder {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private chunk: ChunkState | undefined;

  decodeLine(line: string): RpcFrame[] {
    if (line.length === 0) return [];
    const frame = JSON.parse(line) as RpcFrame;
    if (frame.type !== "rpc_chunk") return [frame];
    return this.decodeChunk(frame);
  }

  private decodeChunk(frame: RpcFrame): RpcFrame[] {
    const chunkId = this.stringField(frame, "chunkId");
    const index = this.numberField(frame, "index");
    const count = this.numberField(frame, "count");
    const byteLength = this.numberField(frame, "byteLength");
    const data = this.stringField(frame, "data");
    if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || index < 0 || index >= count) {
      throw new Error("invalid rpc_chunk index/count");
    }
    if (this.chunk && (this.chunk.chunkId !== chunkId || this.chunk.count !== count || this.chunk.nextIndex !== index)) {
      throw new Error("interleaved or out-of-order rpc_chunk sequence");
    }
    if (!this.chunk) {
      this.chunk = { chunkId, count, nextIndex: 0, byteLength, bytes: [] };
    }
    this.chunk.bytes.push(Buffer.from(data, "base64"));
    this.chunk.nextIndex += 1;
    if (this.chunk.nextIndex !== count) return [];
    const completed = this.chunk;
    this.chunk = undefined;
    const bytes = Buffer.concat(completed.bytes);
    if (bytes.byteLength !== completed.byteLength) throw new Error("rpc_chunk byteLength mismatch");
    const text = this.decoder.decode(bytes);
    const logical = JSON.parse(text) as RpcFrame;
    return [logical];
  }

  private stringField(frame: RpcFrame, name: string): string {
    const value = frame[name];
    if (typeof value !== "string" || value.length === 0) throw new Error(`invalid rpc_chunk ${name}`);
    return value;
  }

  private numberField(frame: RpcFrame, name: string): number {
    const value = frame[name];
    if (typeof value !== "number") throw new Error(`invalid rpc_chunk ${name}`);
    return value;
  }
}

export class RpcClient extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | undefined;
  private stdoutBuffer = "";
  private readonly decoder = new RpcFrameDecoder();
  private readonly pending: Array<{ predicate: (frame: RpcFrame) => boolean; resolve: (frame: RpcFrame) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }> = [];

  async start(command: string, args: string[], cwd: string): Promise<RpcFrame> {
    this.child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.on("data", (data: Buffer) => this.receiveStdout(data));
    this.child.stderr.on("data", (data: Buffer) => this.emit("stderr", data.toString("utf8")));
    this.child.on("error", (error) => this.failPending(error));
    this.child.on("exit", (code, signal) => {
      this.emit("exit", { code, signal });
      if (code !== 0) this.failPending(new Error(`rpc process exited with code=${code} signal=${signal ?? "none"}`));
    });
    return this.waitFor((frame) => frame.type === "ready");
  }

  send(command: RpcCommand): void {
    if (!this.child?.stdin.writable) throw new Error("rpc process is not writable");
    this.child.stdin.write(`${JSON.stringify(command)}\n`);
  }

  async request(command: RpcCommand, timeoutMs = 3_000): Promise<RpcFrame> {
    const id = command.id ?? `rpc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    this.send({ ...command, id });
    return this.waitFor((frame) => frame.type === "response" && frame.id === id, timeoutMs);
  }

  waitFor(predicate: (frame: RpcFrame) => boolean, timeoutMs = 3_000): Promise<RpcFrame> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = this.pending.findIndex((item) => item.timer === timer);
        if (index >= 0) this.pending.splice(index, 1);
        reject(new Error(`timed out waiting for RPC frame after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.push({ predicate, resolve, reject, timer });
    });
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.child = undefined;
    child.stdin.end();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        resolve();
      }, 1_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private receiveStdout(data: Buffer): void {
    this.stdoutBuffer += data.toString("utf8");
    let newline = this.stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).replace(/\r$/, "");
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      for (const frame of this.decoder.decodeLine(line)) this.receiveFrame(frame);
      newline = this.stdoutBuffer.indexOf("\n");
    }
  }

  private receiveFrame(frame: RpcFrame): void {
    this.emit("frame", frame);
    for (let index = 0; index < this.pending.length; index += 1) {
      const waiter = this.pending[index];
      if (waiter && waiter.predicate(frame)) {
        this.pending.splice(index, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(frame);
        return;
      }
    }
  }

  private failPending(error: Error): void {
    for (const waiter of this.pending.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
}
