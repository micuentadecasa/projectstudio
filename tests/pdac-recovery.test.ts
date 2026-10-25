import { describe, expect, it } from "vitest";
import { extractPdacCandidates } from "../apps/desktop/src/renderer/pdac-recovery.js";

const structuredResponse = `Hallazgos confirmados.

\`\`\`json
${JSON.stringify({ pdac: [
  { type: "actor", title: "Practitioner", detail: "Uses the product", confidence: "high" },
  { type: "use-case", title: "Practice a score", detail: "Starts a practice session", confidence: "high" },
  { type: "domain-term", title: "Practice Score", detail: "Canonical score aggregate", confidence: "high" },
  { type: "journey", title: "Source to practice", detail: "Import, inspect and practice", confidence: "medium" },
  { type: "business-rule", title: "Canonical score", detail: "Practice Score is authoritative", confidence: "high" },
  { type: "requirement", title: "Local library", detail: "The library remains local", confidence: "medium" },
  { type: "constraint", title: "Sequential worker", detail: "Only one worker runs at a time", confidence: "high" },
  { type: "bounded-context", title: "Practice", detail: "Owns practice sessions", confidence: "medium" },
] }, null, 2)}
\`\`\``;

describe("recuperación PDAC determinista", () => {
  it("extrae los ocho tipos desde el contrato estructurado sin Electron ni OMP", () => {
    const candidates = extractPdacCandidates(structuredResponse, "overview", []);
    expect(candidates).toHaveLength(8);
    expect(new Set(candidates.map((candidate) => candidate.type))).toEqual(new Set([
      "actor", "use-case", "domain-term", "journey", "business-rule", "requirement", "constraint", "bounded-context",
    ]));
  });

  it("usa el foco actual para recuperar bullets cuando OMP no emite JSON", () => {
    const candidates = extractPdacCandidates("Actores:\n- Persona usuaria: inicia una sesión.\n- Runtime OMR: procesa una imagen.", "actors", []);
    expect(candidates.map((candidate) => candidate.title)).toEqual(["Persona usuaria", "Runtime OMR"]);
    expect(candidates.every((candidate) => candidate.type === "actor")).toBe(true);
  });
});
