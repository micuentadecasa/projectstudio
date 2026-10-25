export type PdacCandidateType = "actor" | "use-case" | "domain-term" | "journey" | "business-rule" | "requirement" | "constraint" | "bounded-context";
export type PdacPage = "overview" | "use-cases" | "actors" | "domains" | "journeys" | "rules" | "requirements" | "contexts";
export type PdacCandidate = { type: PdacCandidateType; title: string; detail: string; evidence?: string; confidence?: string; primaryActor?: string; definedIn?: string };
export type RecoveryFinding = { title: string; detail: string; evidence?: string; kind?: "fact" | "inference" | "unknown" };

export const pdacCandidateTypes: Record<PdacCandidateType, true> = { actor: true, "use-case": true, "domain-term": true, journey: true, "business-rule": true, requirement: true, constraint: true, "bounded-context": true };
const pdacGenericTitles: Record<string, true> = { "propósito": true, "frontera": true, "actores": true, "casos de uso": true, "dominio": true, "journeys": true, "reglas": true, "reglas y restricciones": true, "requisitos": true, "bounded contexts": true, "resultado de la revisión": true, "hallazgos": true };
const pdacSectionTypes: Record<string, PdacCandidateType> = {
  actores: "actor",
  "casos de uso": "use-case",
  "términos de dominio": "domain-term",
  dominio: "domain-term",
  journeys: "journey",
  reglas: "business-rule",
  "reglas de negocio": "business-rule",
  requisitos: "requirement",
  bounded: "bounded-context",
  "bounded contexts": "bounded-context",
};

function candidateTypeFromTitle(title: string, page: PdacPage): { type: PdacCandidateType; title: string } | null {
  const explicit = /^(actor|actor humano|caso de uso|use case|término de dominio|domain term|journey|regla|regla de negocio|requisito|restricción|bounded context)\s*[:-]\s*(.+)$/i.exec(title);
  const explicitMap: Record<string, PdacCandidateType> = {
    actor: "actor", "actor humano": "actor", "caso de uso": "use-case", "use case": "use-case", "término de dominio": "domain-term", "domain term": "domain-term", journey: "journey", regla: "business-rule", "regla de negocio": "business-rule", requisito: "requirement", restricción: "constraint", "bounded context": "bounded-context",
  };
  if (explicit) {
    const explicitKey = explicit[1];
    const explicitTitle = explicit[2];
    const type = explicitKey && explicitTitle ? explicitMap[explicitKey.toLowerCase()] : undefined;
    if (type && explicitTitle) return { type, title: explicitTitle.trim() };
  }
  const pageType: Partial<Record<Exclude<PdacPage, "overview">, PdacCandidateType>> = { actors: "actor", "use-cases": "use-case", domains: "domain-term", journeys: "journey", rules: "business-rule", requirements: "requirement", contexts: "bounded-context" };
  const type = page === "overview" ? undefined : pageType[page];
  if (!type || pdacGenericTitles[title.toLowerCase()]) return null;
  return { type, title };
}

function extractSectionCandidates(text: string, page: PdacPage): PdacCandidate[] {
  const pageType: Partial<Record<Exclude<PdacPage, "overview">, PdacCandidateType>> = { actors: "actor", "use-cases": "use-case", domains: "domain-term", journeys: "journey", rules: "business-rule", requirements: "requirement", contexts: "bounded-context" };
  let activeType = page === "overview" ? undefined : pageType[page];
  const candidates: PdacCandidate[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.replace(/^#+\s*/, "").replace(/[:：]$/, "").trim().toLowerCase();
    const matchedSection = Object.entries(pdacSectionTypes).find(([key]) => heading === key || heading.startsWith(`${key} `));
    if (matchedSection) { activeType = matchedSection[1]; continue; }
    if (page === "overview" && /^(propósito|hechos|hallazgos|observaciones|reglas y restricciones|diagrama|relaciones|siguiente|incógnitas|confianza|estado)\b/.test(heading)) { activeType = undefined; continue; }
    const item = /^(?:[-*•]|\d+[.)])\s+(.+)$/.exec(line)?.[1];
    if (!activeType || !item) continue;
    const parts = /^(.+?)(?:\s*[:：]\s+|\s+—\s+|\s+-\s+)(.+)$/.exec(item);
    const title = (parts?.[1] ?? item).replace(/\*\*/g, "").trim();
    const detail = (parts?.[2] ?? item).replace(/\*\*/g, "").trim();
    if (!title || pdacGenericTitles[title.toLowerCase()]) continue;
    const evidence = /(?:[\w./-]+\.(?:md|tsx?|py|json))(?:[:#]\d+(?:-\d+)?)?/.exec(item)?.[0];
    candidates.push({ type: activeType, title: title.slice(0, 160), detail: detail.slice(0, 2_000), confidence: "medium", ...(evidence ? { evidence } : {}) });
  }
  return candidates.slice(0, 32);
}

function extractStructuredPdacCandidates(text: string): PdacCandidate[] {
  const block = /```(?:json|pdac)\s*([\s\S]*?)```/i.exec(text)?.[1];
  if (!block) return [];
  try {
    const parsed: unknown = JSON.parse(block);
    const values = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && "pdac" in parsed ? (parsed as { pdac?: unknown }).pdac : [];
    if (!Array.isArray(values)) return [];
    return values.flatMap((value) => {
      if (typeof value !== "object" || value === null) return [];
      const input = value as Partial<PdacCandidate>;
      if (typeof input.type !== "string" || !pdacCandidateTypes[input.type as PdacCandidateType] || typeof input.title !== "string" || typeof input.detail !== "string") return [];
      return [{ type: input.type as PdacCandidateType, title: input.title.trim().slice(0, 160), detail: input.detail.trim().slice(0, 2_000), confidence: input.confidence ?? "medium", ...(input.evidence ? { evidence: input.evidence } : {}), ...(input.primaryActor ? { primaryActor: input.primaryActor } : {}), ...(input.definedIn ? { definedIn: input.definedIn } : {}) }];
    });
  } catch {
    return [];
  }
}

export function extractPdacCandidates(text: string, page: PdacPage, findings: RecoveryFinding[]): PdacCandidate[] {
  const structured = extractStructuredPdacCandidates(text);
  if (structured.length > 0) return structured;
  const sectionCandidates = extractSectionCandidates(text, page);
  if (sectionCandidates.length > 0) return sectionCandidates;
  return findings.flatMap((finding) => {
    const resolved = candidateTypeFromTitle(finding.title, page);
    if (!resolved) return [];
    return [{ type: resolved.type, title: resolved.title, detail: finding.detail, ...(finding.evidence ? { evidence: finding.evidence } : {}), confidence: finding.kind === "fact" ? "high" : "medium" }];
  }).slice(0, 16);
}
