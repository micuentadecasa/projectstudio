import type { PdacCandidateType } from "./pdac-recovery.js";

export type PdacFocus = "all" | "use-cases" | "actors" | "domains" | "journeys" | "rules" | "requirements" | "contexts";
export type PdacFocusFinding = { pdacType?: PdacCandidateType; title: string; detail: string };

type Focus = Exclude<PdacFocus, "all">;

export const pdacSignalPatterns: Record<Focus | "purpose", RegExp> = {
  purpose: /propósito|frontera|producto/i,
  actors: /actor|aprendiz|operador|learner|teacher|usuario/i,
  "use-cases": /caso de uso|importar material|practicar|explorar biblioteca|worker local|playback/i,
  domains: /dominio|entidad|concepto|término|agregado|domain/i,
  journeys: /journey|recorrido|flujo|estado|workflow/i,
  rules: /regla|restric|invariant|local-first|debe|permit|historial/i,
  requirements: /requisito|requirement|criterio de aceptación|acceptance|constraint/i,
  contexts: /bounded context|contexto delimitado|instrument-specific|practice material|transcription|acquisition/i,
};

export const pdacSignalTypes: Record<Focus, PdacCandidateType[]> = {
  actors: ["actor"],
  "use-cases": ["use-case"],
  domains: ["domain-term"],
  journeys: ["journey"],
  rules: ["business-rule"],
  requirements: ["requirement", "constraint"],
  contexts: ["bounded-context"],
};

export function matchesPdacFocus(finding: PdacFocusFinding, focus: Focus): boolean {
  return finding.pdacType
    ? pdacSignalTypes[focus].includes(finding.pdacType)
    : pdacSignalPatterns[focus].test(`${finding.title} ${finding.detail}`);
}
