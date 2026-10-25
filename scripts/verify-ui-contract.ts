import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const renderer = await readFile(resolve(import.meta.dirname, "../apps/desktop/src/renderer/main.tsx"), "utf8");
const main = await readFile(resolve(import.meta.dirname, "../apps/desktop/src/main.ts"), "utf8");
const rendererContracts: Array<[string, RegExp]> = [
  ["chat status observable", /data-chat-status=\{chatStatus\}/],
  ["proactive target observable", /data-proactive-target=\{personalityStatus === "working" \? activeProactiveTarget\?\.label/],
  ["canvas uses persisted PDAC node IDs", /nodeIdForFinding\(finding\)/],
  ["focus uses ProductShape CLI before OMP", /productshapeGraph\(\)/],
  ["offline tldraw assets defined", /const offlineSvgDataUrl[\s\S]{0,300}const offlineFontDataUrl/],
  ["focus canvas receives only filtered findings", /page=\{pdacPage\} findings=\{visibleFindings\}/],
  ["long detail list limited to overview", /pdacPage === "overview" && <article className="panel-card pdac-details-card">/],
  ["settled clears proactive target", /event\.type === "session_settled"[\s\S]{0,220}setActiveProactiveTarget\(null\)/],
  ["autonomous mode is explicit", /data-recovery-mode=\{autonomousRecovery \? "autonomous-test" : "interactive"\}/],
  ["OMP candidates promote through ProductShape", /promoteAutonomousCandidates\(candidates\)/],
];
const mainContracts: Array<[string, RegExp]> = [
  ["draft promotion writes ProductShape documents", /writeFile\(document\.path, document\.content/],
  ["draft promotion recompiles ProductShape", /const result = await runProductShapeGraph\(\)/],
];
const missing = [
  ...rendererContracts.filter(([, pattern]) => !pattern.test(renderer)),
  ...mainContracts.filter(([, pattern]) => !pattern.test(main)),
].map(([name]) => name);
const contracts = [...rendererContracts, ...mainContracts];
if (missing.length > 0) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, launchesApp: false, contracts: contracts.map(([name]) => name) }, null, 2));
