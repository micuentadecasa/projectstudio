import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSqliteApprovalSpike } from "../packages/orchestrator/src/sqlite-spike.js";

const directory = join(tmpdir(), "projectstudio-fase00");
await mkdir(directory, { recursive: true });
const dbPath = join(directory, "langgraph-spike.sqlite");
await rm(dbPath, { force: true });
const result = await runSqliteApprovalSpike(dbPath, "phase00-thread");
console.log(JSON.stringify({ dbPath, ...result }, null, 2));
