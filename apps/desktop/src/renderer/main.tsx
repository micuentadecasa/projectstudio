import React, { StrictMode, useEffect, useId, useMemo, useRef, useState } from "react";
import { Tldraw, createShapeId, iconTypes, toRichText } from "tldraw";
import "tldraw/tldraw.css";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { extractMermaid, layoutDiagram, parseMermaid } from "./diagrams.js";
import { visibleTextDelta } from "./chat-events.js";
type Message = { author: "user" | "omp"; text: string; streaming?: boolean };
type DiagramRevision = { id: string; source: string; label: string; status: "stored" | "provisional"; createdAt: string };
type FindingKind = "fact" | "inference" | "unknown";
type AssistantFinding = { id: string; title: string; detail: string; evidence?: string; kind?: FindingKind; live?: boolean };
type ProactiveTarget = { label: string };
type PdacPage = "overview" | "use-cases" | "actors" | "domains" | "journeys" | "rules" | "requirements" | "contexts";
type PdacFocus = "all" | "use-cases" | "actors" | "domains" | "journeys" | "rules" | "requirements" | "contexts";
const pdacPageLabels: Record<PdacPage, string> = { overview: "ProductShape", "use-cases": "Casos de uso", actors: "Actores", domains: "Dominio", journeys: "Journeys", rules: "Reglas y restricciones", requirements: "Requisitos", contexts: "Bounded contexts" };
const pdacArtifactTypeLabels: Record<string, string> = {
  actor: "Actor",
  "use-case": "Caso de uso",
  journey: "Journey",
  "domain-term": "Término de dominio",
  "business-rule": "Regla de negocio",
  requirement: "Requisito",
  "functional-requirement": "Requisito funcional",
  "quality-requirement": "Requisito de calidad",
  constraint: "Restricción",
  "bounded-context": "Bounded context",
  behaviour: "Comportamiento",
  "structured-behaviour": "Comportamiento estructurado",
};
const offlineSvgDataUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='currentColor' d='M4 4h16v16H4z'/%3E%3C/svg%3E";
const offlineFontDataUrl = "";
const offlineTldrawAssetUrls = {
  icons: Object.fromEntries(iconTypes.map((icon) => [icon, offlineSvgDataUrl])),
  translations: { en: "./tldraw-en.json" },
  embedIcons: Object.fromEntries(["tldraw", "figma", "canva", "google_maps", "codesandbox", "codepen", "scratch", "youtube", "google_calendar", "google_slides", "github_gist", "replit", "felt", "spotify", "vimeo", "observable", "desmos", "val_town"].map((icon) => [icon, offlineSvgDataUrl])),
  fonts: Object.fromEntries(["tldraw_mono", "tldraw_mono_italic", "tldraw_mono_bold", "tldraw_mono_italic_bold", "tldraw_sans", "tldraw_sans_italic", "tldraw_sans_bold", "tldraw_sans_italic_bold", "tldraw_serif", "tldraw_serif_italic", "tldraw_serif_bold", "tldraw_serif_italic_bold", "tldraw_draw", "tldraw_draw_italic", "tldraw_draw_bold", "tldraw_draw_italic_bold"].map((font) => [font, offlineFontDataUrl])),
};

function extractAssistantFindings(text: string, includeSummary = true, maxFindings = 8): AssistantFinding[] {
  const withoutDiagram = text.replace(/```[\s\S]*?```/g, "");
  const normalized = withoutDiagram.replace(/\s+(?=#{1,3}\s+)/g, "\n");
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const findings: AssistantFinding[] = [];
  for (let index = 0; index < lines.length && findings.length < maxFindings; index += 1) {
    const heading = /^(?:#{1,3}\s+|\*\*)(.+?)(?:\*\*)?$/.exec(lines[index]);
    const bullet = /^[-*]\s+(.+)$/.exec(lines[index]);
    if (!heading && !bullet) continue;
    const rawTitle = (heading?.[1] ?? bullet?.[1] ?? "").trim();
    const normalizedTitle = rawTitle.replace(/\*\*/g, "").trim();
    const contentBoundary = /\s+(?=Se tomó|El |La |Los |Las |Después |Verificación |Incluye |Usa |Para )/.exec(rawTitle)?.index ?? Number.POSITIVE_INFINITY;
    const emphasisBoundary = rawTitle.search(/\s+\*\*/);
    const boundary = Math.min(contentBoundary, emphasisBoundary >= 0 ? emphasisBoundary : Number.POSITIVE_INFINITY);
    const title = (boundary >= 0 ? normalizedTitle.slice(0, boundary) : normalizedTitle).trim();
    if (!title) continue;
    const inlineDetail = boundary >= 0 ? normalizedTitle.slice(boundary).trim() : "";
    const detail = inlineDetail || lines.slice(index + 1).find((line) => !/^(?:#{1,3}\s+|\*\*|[-*]\s+)/.test(line))?.replace(/\*\*/g, "").trim();
    const evidence = /(?:[\w./-]+\.(?:md|tsx?|py|json))(?:[:#]\d+(?:-\d+)?)?/.exec(`${title} ${detail ?? ""}`)?.[0];
    const cleanDetail = (detail ?? "Hallazgo publicado por el asistente.").slice(0, 180);
    findings.push({ id: findingId(title, findings.length), title, detail: cleanDetail, evidence, kind: classifyFinding(title, cleanDetail) });
  }
  if (findings.length > 0) return findings;
  const summary = withoutDiagram.replace(/\s+/g, " ").trim();
  return includeSummary && summary ? [{ id: "finding-summary", title: "Resultado de la revisión", detail: summary.slice(0, 180), kind: "fact" }] : [];
}
function extractStreamingProgress(text: string): { title: string; detail: string } | undefined {
  const lines = text
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean);
  if (lines.length === 0) return undefined;
  const headings = lines.filter((line) => /^#{1,4}\s+/.test(line)).map((line) => line.replace(/^#{1,4}\s+/, "").replace(/\*\*/g, "").trim());
  const currentSection = headings.at(-1);
  const latest = lines.at(-1)?.replace(/^#{1,4}\s+/, "").replace(/\*\*/g, "").trim();
  if (!latest) return undefined;
  return {
    title: currentSection ? `Analizando: ${currentSection.slice(0, 80)}` : "Evidencia recibida",
    detail: latest.slice(0, 180),
  };
}
function buildEvidencePreviewMermaid(findings: AssistantFinding[]): string {
  const lines = ["flowchart LR", 'Evidence["Evidencia OMP · hallazgos recibidos"]'];
  findings.slice(0, 6).forEach((finding, index) => {
    const label = finding.title.replace(/["[\]`]/g, "").slice(0, 70);
    lines.push(`H${index + 1}["${label}"]`);
    lines.push(`Evidence -.-> H${index + 1}`);
  });
  return lines.join("\n");
}
function findingId(title: string, index: number): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48);
  return `finding-${index}-${slug || "hallazgo"}`;
}
function classifyFinding(title: string, detail: string): FindingKind {
  const text = `${title} ${detail}`.toLowerCase();
  if (/incógnita|pendiente|por confirmar|desconocid|no se pudo verificar|falta evidencia/.test(text)) return "unknown";
  if (/inferencia|parece|probable|sugiere|podría|se deduce/.test(text)) return "inference";
  return "fact";
}
function findingsFromProjectArtifacts(artifacts: StudioPdacArtifact[]): AssistantFinding[] {
  return artifacts.map((artifact) => {
    const label = pdacArtifactTypeLabels[artifact.type] ?? artifact.type;
    const title = `${label}: ${artifact.title}`;
    const detail = `Estado ${artifact.status ?? "sin estado"} · evidencia ${artifact.path ?? "sin ruta"}`;
    return { id: artifact.id, title, detail, evidence: artifact.path, kind: classifyFinding(title, detail) };
  });
}
const domainTermNames = ["Song", "Instrument Part", "Practice Score Revision", "Import Bundle", "ImportJob", "Practice Score JSON", "MusicXML", "playback", "SQLite repository", "biblioteca local", "canción", "progreso de práctica"];
function extractDomainTerms(text: string): AssistantFinding[] {
  const normalized = text.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ");
  const terms: AssistantFinding[] = [];
  for (const term of domainTermNames) {
    const match = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").exec(normalized);
    if (!match) continue;
    const start = Math.max(0, match.index - 90);
    const end = Math.min(normalized.length, match.index + term.length + 180);
    const detail = normalized.slice(start, end).replace(/\*\*/g, "").trim();
    terms.push({ id: `domain-${term.toLowerCase().replace(/\W+/g, "-")}`, title: term, detail: detail || "Término de dominio encontrado en la evidencia del proyecto.", kind: "fact" });
  }
  return terms;
}
function detectLiveFinding(text: string): AssistantFinding | undefined {
  const heading = /(?:^|\n)\s*#{1,4}\s*(?:\d+\.\s*)?(Casos de uso principales|Actores|Propósito y frontera del producto|Bounded contexts|Reglas e invariantes|Restricciones)/im.exec(text);
  const useCase = /(?:^|\n)\s*#{1,4}\s*(?:[A-F]\.\s*)?(Importar material|Ejecutar el worker local|Persistir material de práctica|Explorar biblioteca y revisiones|Practicar un score activo|Coaching contextual)/im.exec(text);
  const label = useCase?.[1] ?? heading?.[1];
  if (!label) return undefined;
  return {
    id: `live-${label}`,
    title: useCase ? `Nuevo caso de uso: ${label}` : `Nuevo hallazgo: ${label}`,
    detail: "El asistente acaba de identificarlo; el mapa provisional se actualizará con esta evidencia.",
    live: true,
  };
}
function describeToolCall(name: string): { title: string; detail: string } {
  const normalized = name.toLowerCase();
  if (/read|cat|file|open/.test(normalized)) return { title: "Leyendo evidencia del proyecto", detail: "OMP está contrastando documentos y archivos existentes." };
  if (/search|grep|find|glob/.test(normalized)) return { title: "Buscando señales del modelo", detail: "OMP está localizando conceptos, actores y reglas en el repositorio." };
  if (/shell|exec|command|run/.test(normalized)) return { title: "Verificando el comportamiento real", detail: "OMP está comprobando rutas y relaciones contra el código." };
  return { title: `Herramienta OMP · ${name}`, detail: "ProjectStudio recibió una actualización de la inspección." };
}

const navigation: Array<{ section: Section; icon: string; detail: string }> = [
  { section: "Resumen", icon: "⌂", detail: "Vista del proyecto" },
  { section: "ProductShape", icon: "◇", detail: "Producto y casos de uso" },
  { section: "Arquitectura", icon: "◎", detail: "C4 y escenarios" },
  { section: "Evidencia", icon: "▣", detail: "Hechos verificables" },
  { section: "Cambios", icon: "⇄", detail: "Diffs y aprobaciones" },
];

const initialMessages: Message[] = [
  { author: "omp", text: "Soy tu Arquitecto de Proyecto. Ya tengo este repositorio en contexto. Te propongo empezar por entender el producto o documentar la arquitectura existente. Primero construimos una base con evidencia; después podremos plantear cambios con criterio. Elige una opción o escríbeme una pregunta." },
];
type PersistedWorkspaceState = {
  section: "Resumen" | "ProductShape" | "Arquitectura" | "Evidencia" | "Cambios";
  activeTab: string;
  pdacPage: PdacPage;
  pdacFocus: PdacFocus;
  selectedObjective: "understand" | "architecture" | "greenfield" | null;
};
const workspaceStateKey = (projectId: string): string => `projectstudio:workspace:${projectId}`;
function readWorkspaceState(projectId: string): PersistedWorkspaceState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(workspaceStateKey(projectId)) ?? "null") as Partial<PersistedWorkspaceState> | null;
    if (!parsed || !parsed.section || !parsed.pdacPage || !parsed.pdacFocus) return null;
    return parsed as PersistedWorkspaceState;
  } catch {
    return null;
  }
}
const personalityIdleStorageKey = "projectstudio:personality-idle-ms";
const personalityIdleOptions = [10_000, 20_000, 60_000, 300_000, 900_000] as const;
const defaultPersonalityIdleMs = 20_000;
function readPersonalityIdleMs(): number {
  const configured = Number(localStorage.getItem(personalityIdleStorageKey));
  return personalityIdleOptions.includes(configured as (typeof personalityIdleOptions)[number]) ? configured : defaultPersonalityIdleMs;
}

function reviewPrompt(section: Section): string {
  if (section === "ProductShape") return "PRODUCTSHAPE: analiza el producto usando primero docs/product y después el código para corroborar. Extrae propósito, actores, casos de uso, bounded contexts, reglas y restricciones. Devuelve hallazgos con rutas verificables y un único bloque Mermaid flowchart LR confirmado. No inventes componentes.";
  if (section === "Arquitectura") return "ARCHITECTURE: inspecciona src/ y tests/ reales del proyecto. Describe componentes, entradas, salidas, persistencia y relaciones confirmadas. Devuelve hallazgos con rutas verificables y un único bloque Mermaid flowchart LR confirmado. No inventes componentes.";
  return "Revisa el proyecto seleccionado y genera hallazgos verificables y un diagrama Mermaid basado sólo en el código real.";
}
function pdacEntityPrompt(page: Exclude<PdacPage, "overview">): string {
  const focus = page === "use-cases"
    ? "casos de uso y sus actores, precondiciones y resultados"
    : page === "actors"
      ? "actores humanos, sistemas externos y sus responsabilidades"
      : page === "domains"
        ? "términos, entidades y límites del dominio"
        : page === "journeys"
          ? "journeys, recorridos y estados que atraviesa cada actor"
          : page === "rules"
            ? "reglas de negocio, invariantes y restricciones"
            : page === "requirements"
              ? "requisitos, criterios de aceptación y restricciones verificables"
              : "bounded contexts, límites y relaciones entre contextos";
  return `PRODUCTSHAPE: profundiza sólo en ${focus}. Usa primero docs/product y contrasta con el código. Devuelve hallazgos con rutas verificables y actualiza el diagrama Mermaid sólo con relaciones confirmadas. No inventes datos.`;
}
function pdacGuidance(signalId: string): { title: string; detail: string; prompt: string } {
  if (signalId === "purpose") return { title: "Confirmar propósito y frontera", detail: "Primero necesito separar qué problema resuelve el producto de lo que queda fuera.", prompt: "PRODUCTSHAPE: profundiza en el propósito y la frontera del producto. Usa docs/product y el código como contraste. Devuelve sólo hechos, incógnitas y rutas verificables. No inventes datos ni arquitectura alternativa." };
  if (signalId === "actors") return { title: "Identificar actores", detail: "Después comprobaremos quién usa, opera o alimenta el sistema.", prompt: pdacEntityPrompt("actors") };
  if (signalId === "use-cases") return { title: "Ordenar casos de uso", detail: "Con los actores claros, el siguiente paso es describir sus objetivos y resultados.", prompt: pdacEntityPrompt("use-cases") };
  if (signalId === "rules") return { title: "Hacer explícitas las reglas", detail: "Buscaremos invariantes y restricciones que no deberían perderse al cambiar el sistema.", prompt: pdacEntityPrompt("rules") };
  return { title: "Delimitar bounded contexts", detail: "Por último agruparemos capacidades y límites sólo donde haya evidencia suficiente.", prompt: pdacEntityPrompt("contexts") };

}
function DiagramVisual({ source, canvas = false }: { source: string; canvas?: boolean }): JSX.Element {
  const diagram = parseMermaid(source);
  const layout = layoutDiagram(diagram);
  const markerId = `diagram-arrow-${useId().replaceAll(":", "")}`;
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  return (
    <div className={canvas ? "diagram-canvas" : "chat-diagram"} aria-label="Diagrama Mermaid generado por OMP">
      <svg className="diagram-svg" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="Vista de relaciones del proyecto">
        <defs>
          <marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill="var(--accent)" />
          </marker>
        </defs>
        {layout.edges.map((edge, index) => {
          const from = nodes.get(edge.from);
          const to = nodes.get(edge.to);
          if (!from || !to) return null;
          const startX = from.x + from.width;
          const startY = from.y + from.height / 2;
          const endX = to.x;
          const endY = to.y + to.height / 2;
          const forward = endX >= startX;
          const path = forward
            ? `M ${startX} ${startY} C ${startX + 38} ${startY}, ${endX - 38} ${endY}, ${endX} ${endY}`
            : `M ${startX} ${startY} C ${startX + 32} ${startY - 34}, ${endX - 32} ${endY - 34}, ${endX} ${endY}`;
          return <path className="diagram-edge" key={`${edge.from}-${edge.to}-${index}`} d={path} markerEnd={`url(#${markerId})`} />;
        })}
        {layout.nodes.map((node) => (
          <g className="diagram-svg-node" key={node.id}>
            <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="8" />
            <text x={node.x + node.width / 2} y={node.y + 20} textAnchor="middle">
              {node.lines.map((line, index) => <tspan key={`${node.id}-${index}`} x={node.x + node.width / 2} dy={index === 0 ? 0 : 12}>{line}</tspan>)}
            </text>
            <text className="diagram-svg-id" x={node.x + node.width / 2} y={node.y + node.height - 8} textAnchor="middle">{node.id}</text>
          </g>
        ))}
      </svg>
      <small className="diagram-caption">Mapa de relaciones · generado por OMP con evidencia del proyecto</small>
    </div>
  );
}

function canvasText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(canvasText).join("");
  if (typeof value !== "object" || value === null) return "";
  const record = value as Record<string, unknown>;
  if (typeof record.text === "string") return record.text;
  return Object.entries(record).filter(([key]) => key !== "attrs" && key !== "type").map(([, child]) => canvasText(child)).join("");
}
function PdacCanvas({ projectId, page, findings }: { projectId: string; page: PdacPage; findings: AssistantFinding[] }): JSX.Element {
  const persistenceKey = `projectstudio-pdac:v2:${projectId}:${page}`;
  const hasFindings = findings.length > 0;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const editorPageRef = useRef<PdacPage | null>(null);
  const seed = hasFindings
    ? findings.slice(0, 8)
    : [{ id: `empty-${page}`, title: `Aún no hay hallazgos de ${pdacPageLabels[page].toLowerCase()}`, detail: "El lienzo queda preparado para el siguiente resultado verificable.", kind: "unknown" as const }];
  const nodeIdForFinding = (finding: AssistantFinding): string => /^(finding-|live-|canvas-|empty-)/.test(finding.id) ? `canvas-${page}-${finding.id.replace(/[^a-z0-9_-]/gi, "-")}` : finding.id;
  const seedSignature = seed.map((finding) => finding.id).join("|");
  const editorRef = useRef<{ getCurrentPageShapes: () => ReadonlyArray<{ id: string; props?: Record<string, unknown>; meta?: Record<string, unknown> }>; createShapes: (shapes: ReadonlyArray<Record<string, unknown>>) => void; deleteShapes: (ids: ReadonlyArray<string>) => void; zoomToFit: (options: { animation: { duration: number } }) => void; setCamera: (camera: { x: number; y: number; z: number }, options?: { immediate?: boolean }) => void } | null>(null);
  const seedInterval = useRef<number | null>(null);
  const viewportRecoveryAttempts = useRef(0);
  const [fallbackVisible, setFallbackVisible] = useState(true);
  const canvasListenerRef = useRef<(() => void) | undefined>(undefined);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const syncCanvas = (): void => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const edits = editor.getCurrentPageShapes().flatMap((shape) => {
        const nodeId = typeof shape.meta?.pdacNodeId === "string" ? shape.meta.pdacNodeId : `canvas-${page}-${shape.id}`;
        const title = canvasText(shape.props?.richText).replace(/\s+/g, " ").trim();
        return title ? [{ nodeId, title }] : [];
      });
      void Promise.all(edits.map((edit) => window.studio.project.savePdacEdit({ ...edit, page })));
    }, 250);
  };
  const createSeedShapes = (prefix = "pdac"): ReadonlyArray<Record<string, unknown>> => seed.map((finding, index) => ({
    id: createShapeId(`${prefix}-${page}-${index}`),
    type: "geo" as const,
    x: 80 + (index % 3) * 300,
    y: 80 + Math.floor(index / 3) * 150,
    meta: { pdacNodeId: nodeIdForFinding(finding), pdacPlaceholder: !hasFindings },
    props: {
      geo: "rectangle" as const,
      w: 260,
      h: 110,
      richText: toRichText(finding.title.slice(0, 52)),
      color: finding.kind === "unknown" ? "orange" as const : finding.kind === "inference" ? "violet" as const : "blue" as const,
    },
  }));
  const seedCanvas = (): void => {
    const editor = editorRef.current;
    const stage = stageRef.current;
    if (!editor || editorPageRef.current !== page) {
      setFallbackVisible(true);
      stage?.setAttribute("data-canvas-status", "editor-pending");
      return;
    }
    const currentShapes = editor.getCurrentPageShapes();
    stage?.setAttribute("data-shape-count", String(currentShapes.length));
    const onlyPlaceholder = currentShapes.length > 0 && currentShapes.every((shape) => shape.meta?.pdacPlaceholder === true);
    const hasSeedShape = currentShapes.some((shape) => typeof shape.meta?.pdacNodeId === "string" && shape.meta.pdacNodeId.startsWith(`canvas-${page}-`));
    if (hasFindings && onlyPlaceholder) editor.deleteShapes(currentShapes.map((shape) => shape.id));
    else if (hasSeedShape || currentShapes.length > 0) {
      const renderedShapeCount = stage?.querySelectorAll('.tl-shape[data-shape-id^="shape:"]').length ?? 0;
      if (renderedShapeCount === 0) {
        setFallbackVisible(true);
        viewportRecoveryAttempts.current += 1;
        if (viewportRecoveryAttempts.current >= 6) {
          editor.deleteShapes(currentShapes.map((shape) => shape.id));
          editor.createShapes(createSeedShapes(`pdac-reseed-${Date.now()}`));
          viewportRecoveryAttempts.current = 0;
          stage?.setAttribute("data-canvas-status", "reseeded");
          return;
        }
        editor.zoomToFit({ animation: { duration: 0 } });
        stage?.setAttribute("data-canvas-status", "recovering-viewport");
        return;
      }
      setFallbackVisible(false);
      viewportRecoveryAttempts.current = 0;
      stage?.setAttribute("data-canvas-status", "existing-shapes");
      return;
    }
    setFallbackVisible(true);
    editor.createShapes(createSeedShapes());
    const createdShapeCount = editor.getCurrentPageShapes().length;
    stage?.setAttribute("data-shape-count", String(createdShapeCount));
    stage?.setAttribute("data-canvas-status", createdShapeCount > 0 ? "seeded" : "seed-empty");
    editor.zoomToFit({ animation: { duration: 0 } });
  };
  useEffect(() => {
    seedCanvas();
  }, [page, seedSignature]);
  useEffect(() => () => {
    seedTimers.current.forEach((timer) => clearTimeout(timer));
    if (seedInterval.current !== null) window.clearInterval(seedInterval.current);
    clearTimeout(syncTimer.current);
    canvasListenerRef.current?.();
    viewportRecoveryAttempts.current = 0;
    editorPageRef.current = null;
    editorRef.current = null;
  }, []);
  return (
    <div className="pdac-tldraw-wrap" data-testid="pdac-tldraw-canvas" data-pdac-page={page} data-pdac-project={projectId}>
      <div className="pdac-canvas-toolbar"><span className="card-kicker">LIENZO PDAC · OFFLINE</span><span>Arrastra, edita y añade detalles. Se guarda en este dispositivo.</span></div>
      <div className="pdac-tldraw-stage" ref={stageRef}>
        <Tldraw
          persistenceKey={persistenceKey}
          assetUrls={offlineTldrawAssetUrls}
          locale="en"
          onMount={(editor) => {
            editorPageRef.current = page;
            canvasListenerRef.current?.();
            editorRef.current = editor;
            canvasListenerRef.current = editor.store.listen(() => syncCanvas(), { scope: "document" });
            seedCanvas();
            seedTimers.current.forEach((timer) => clearTimeout(timer));
            seedTimers.current = [250, 1000, 2500, 5000, 8000].map((delay) => window.setTimeout(seedCanvas, delay));
            if (seedInterval.current !== null) window.clearInterval(seedInterval.current);
            seedInterval.current = window.setInterval(seedCanvas, 500);
          }}
          onChange={syncCanvas}
        />
        {fallbackVisible && <div className="pdac-canvas-fallback" data-testid="pdac-canvas-fallback" aria-label="Vista verificable del lienzo">
          {seed.map((finding, index) => <div
            className="pdac-canvas-fallback-shape"
            data-shape-id={`fallback:${page}:${finding.id}`}
            key={finding.id}
            contentEditable
            suppressContentEditableWarning
            onBlur={(event) => {
              const title = event.currentTarget.textContent?.replace(/\s+/g, " ").trim() ?? "";
              if (title && title !== finding.title) void window.studio.project.savePdacEdit({ page, nodeId: nodeIdForFinding(finding), title });
            }}
            style={{ left: `${80 + (index % 3) * 300}px`, top: `${80 + Math.floor(index / 3) * 150}px` }}
          >{finding.title}</div>)}
        </div>}
      </div>
    </div>
  );
}

function formatAssistantText(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#{1,4}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function AssistantContent({ text }: { text: string }): JSX.Element {
  const source = extractMermaid(text);
  if (!source) return <div className="assistant-readable">{formatAssistantText(text)}</div>;
  const match = /```mermaid\s*\n([\s\S]*?)```/i.exec(text);
  const before = match ? text.slice(0, match.index) : text;
  const after = match ? text.slice((match.index ?? 0) + match[0].length) : "";
  return <><div className="assistant-readable">{formatAssistantText(`${before}\n${after}`)}</div><div className="chat-diagram-link">Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.</div></>;
}
function stringField(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === "string" ? value[key] as string : undefined;
}
function displayChatStatus(status: string): string {
  if (status === "starting" || status === "submitting") return "iniciando";
  return "trabajando";
}
function humanizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOENT|spawn .*omp|omp.*not found/i.test(message)) return "No se pudo conectar con OMP. Comprueba que `omp` está instalado, autenticado y disponible en PATH.";
  if (/login|auth|credential|model/i.test(message)) return "OMP necesita autenticación y un modelo configurado. Ejecuta `omp login` y vuelve a intentarlo.";
  return message;
}
function App(): JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [section, setSection] = useState<Section>("Resumen");
  const [project, setProject] = useState("proyecto · configurando");
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectMode, setProjectMode] = useState<"brownfield" | "greenfield">("brownfield");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [storedDiagram, setStoredDiagram] = useState<string | null>(null);
  const [diagramRevisions, setDiagramRevisions] = useState<DiagramRevision[]>([]);
  const [selectedDiagramRevisionId, setSelectedDiagramRevisionId] = useState<string | null>(null);
  const [assistantFindings, setAssistantFindings] = useState<AssistantFinding[]>([]);
  const [pdacFocus, setPdacFocus] = useState<PdacFocus>("all");
  const [pdacPage, setPdacPage] = useState<PdacPage>("overview");
  const [activeTab, setActiveTab] = useState("Resumen");
  const [chatMode, setChatMode] = useState("real");
  const [chatStatus, setChatStatus] = useState("starting");
  const [chatError, setChatError] = useState("");
  const [activity, setActivity] = useState("Preparando el proyecto");
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [analysisStale, setAnalysisStale] = useState(false);
  const [analysisReport, setAnalysisReport] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const streamingDraft = useRef("");
  const lastInteractionAt = useRef(Date.now());
  const lastProactiveReviewAt = useRef(0);
  const userSelectedPdacPage = useRef(false);
  const streamingRevisionId = useRef<string | null>(null);
  const queuedObjective = useRef<{ prompt: string; workflow: "brownfield-discovery" | "architecture-documentation" | "architecture-planning" } | null>(null);
  const [personalityIdleMs, setPersonalityIdleMs] = useState(defaultPersonalityIdleMs);
  const [personalityStatus, setPersonalityStatus] = useState<"waiting" | "working">("waiting");
  const [activeProactiveTarget, setActiveProactiveTarget] = useState<ProactiveTarget | null>(null);
  const [personalityCountdownMs, setPersonalityCountdownMs] = useState(defaultPersonalityIdleMs);
  useEffect(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, sending, activity]);
  useEffect(() => {
    setPersonalityIdleMs(readPersonalityIdleMs());
  }, []);
  useEffect(() => {
    const updateCountdown = (): void => {
      if (assistantFindings.length === 0 || personalityStatus === "working" || sending) {
        setPersonalityCountdownMs(0);
        return;
      }
      setPersonalityCountdownMs(Math.max(0, personalityIdleMs - (Date.now() - lastInteractionAt.current)));
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, [assistantFindings.length, personalityIdleMs, personalityStatus, sending]);
  const [selectedObjective, setSelectedObjective] = useState<"understand" | "architecture" | "greenfield" | null>(null);
  const workspaceHydrating = useRef(false);
  const sendMessageRef = useRef<((prompt: string, workflow?: "brownfield-discovery" | "architecture-documentation" | "architecture-planning", proactiveLabel?: string) => Promise<void>) | null>(null);
  useEffect(() => {
    if (!activeProjectId || workspaceHydrating.current) return;
    localStorage.setItem(workspaceStateKey(activeProjectId), JSON.stringify({ section, activeTab, pdacPage, pdacFocus, selectedObjective } satisfies PersistedWorkspaceState));
  }, [activeProjectId, activeTab, pdacFocus, pdacPage, section, selectedObjective]);
  function publishStreamingDiagram(source: string, label = "Vista provisional en directo"): void {
    const revisionId = streamingRevisionId.current ?? `streaming-${Date.now()}`;
    streamingRevisionId.current = revisionId;
    const revision: DiagramRevision = { id: revisionId, source, label, status: "provisional", createdAt: "generándose ahora" };
    setDiagramRevisions((current) => {
      const existing = current.some((candidate) => candidate.id === revisionId);
      return existing ? current.map((candidate) => candidate.id === revisionId ? revision : candidate) : [...current, revision].slice(-12);
    });
    setSelectedDiagramRevisionId(revisionId);
  }
  function beginProgress(): void {
    setProgressSteps([{ id: "inspect", title: "Preparando la inspección", detail: "ProjectStudio ha enviado el objetivo al workflow brownfield.", status: "active" }]);
  }
  function addProgressStep(step: Omit<ProgressStep, "id">): void {
    setProgressSteps((current) => [
      ...current.map((item) => item.status === "active" ? { ...item, status: "done" as const } : item),
      { ...step, id: `progress-${Date.now()}` },
    ].slice(-6));
  }
  function updateProgress(title: string, detail: string): void {
    setProgressSteps((current) => {
      if (current.length === 0) return [{ id: "stream", title, detail, status: "active" }];
      return current.map((item, index) => index === current.length - 1 ? { ...item, title, detail } : item);
    });
  }

  async function reloadProjectSurface(): Promise<void> {
    workspaceHydrating.current = true;
    setBootstrapFailed(false);
    setSelectedObjective(null);
    userSelectedPdacPage.current = false;
    const registry = await window.studio.projects.list();
    setProjects(registry.projects);
    const active = registry.projects.find((candidate) => candidate.id === registry.activeId);
    const activeMode = active?.mode ?? (active?.detected.empty ? "greenfield" : "brownfield");
    setProjectMode(activeMode);
    if (active) {
      setActiveProjectId(active.id);
      setProject(`${active.name} · ${activeMode === "greenfield" ? "greenfield" : active.archived ? "archivado" : "cwd configurado"}`);
    }
    const persistedState = active ? readWorkspaceState(active.id) : null;
    const analysis = await window.studio.project.analysis();
    if (persistedState) {
      setSection(persistedState.section as Section);
      setActiveTab(persistedState.activeTab);
      setPdacPage(persistedState.pdacPage);
      setPdacFocus(persistedState.pdacFocus);
      setSelectedObjective(persistedState.selectedObjective);
    } else if (analysis.source === "project-pdac") {
      setSection("ProductShape");
      setActiveTab("ProductShape");
    }
    workspaceHydrating.current = false;
    const recoveredFindings = analysis.artifacts?.length ? findingsFromProjectArtifacts(analysis.artifacts) : analysis.report ? extractAssistantFindings(analysis.report, true, analysis.source === "project-pdac" ? 64 : 8) : [];
    setAnalysisReport(analysis.report ?? "");
    setStoredDiagram(analysis.mermaid);
    setAssistantFindings(recoveredFindings);
    setAnalysisStale(Boolean(analysis.stale));
    setMessages(recoveredFindings.length > 0
      ? [{ author: "omp", text: analysis.source === "project-pdac"
        ? `He cargado ${recoveredFindings.length} elementos del PDAC que vive en el proyecto. Esa documentación es la fuente de verdad${analysis.stale ? " y también detecté cambios adicionales." : "."}`
        : `He recuperado ${recoveredFindings.length} hallazgo${recoveredFindings.length === 1 ? "" : "s"} PDAC del último estado guardado${analysis.stale ? ". También detecté cambios en las carpetas de producto o arquitectura; conviene revisar el proyecto." : "."}` }]
      : activeMode === "greenfield"
        ? [{ author: "omp", text: "Este proyecto está vacío. Soy tu Arquitecto de Proyecto y te ayudaré a convertir una idea en un borrador PDAC. Cuéntame el primer caso de uso que quieres resolver; después te preguntaré por el actor, el resultado y las reglas importantes." }]
        : initialMessages);
    if (analysis.mermaid) {
      const revision: DiagramRevision = { id: "stored-analysis", source: analysis.mermaid, label: "Mapa guardado", status: "stored", createdAt: "evidencia existente" };
      setDiagramRevisions([revision]);
      setSelectedDiagramRevisionId(revision.id);
    } else {
      setDiagramRevisions([]);
      setSelectedDiagramRevisionId(null);
    }
    const result = await window.studio.chat.start();
    setChatMode(result.mode);
    setChatStatus(result.status);
    setProject(`${result.projectName} · ${activeMode === "greenfield" ? "greenfield" : "cwd configurado"}`);
    if (result.error) setChatError(humanizeError(result.error));
    const bootstrap = await window.studio.project.bootstrap({ resume: false });
    if (bootstrap.status === "running") {
      setSending(true);
      setActivity("Descubrimiento inicial en curso…");
    } else if (bootstrap.status === "greenfield") {
      setSending(false);
      setActivity("Esperando el primer caso de uso");
    } else if (bootstrap.status === "stored-artifact" || bootstrap.status === "completed") {
      setActivity("Análisis inicial disponible");
    } else if (bootstrap.status === "failed") {
      setBootstrapFailed(true);
      setActivity("El descubrimiento se detuvo");
    }
  }

  useEffect(() => {
    const unsubscribe = window.studio.chat.onEvent((event) => {
      if (event.type === "status") {
        setChatStatus(event.status);
        if (event.status === "starting") {
          setActivity("Conectando con OMP…");
          updateProgress("Conectando con OMP", "Esperando la sesión real del asistente.");
        }
      } else if (event.type === "ready") {
        setChatStatus("ready");
        setActivity("Listo para continuar");
        updateProgress("Sesión OMP lista", "El workflow puede comenzar la inspección.");
      } else if (event.type === "message_update") {
        const delta = visibleTextDelta(event.frame);
        if (delta) {
          streamingDraft.current += delta;
          setStreamingText(streamingDraft.current);
          const progress = extractStreamingProgress(streamingDraft.current);
          if (progress) {
            updateProgress(progress.title, progress.detail);
          } else {
            updateProgress("Recibiendo hallazgos de OMP", "Cada hallazgo confirmado actualiza el centro y el mapa provisional.");
          }
          const partialFindings = extractAssistantFindings(streamingDraft.current, false);
          const source = extractMermaid(streamingDraft.current);
          if (partialFindings.length > 0) {
            setAssistantFindings((current) => {
              const incomingIds = new Set(partialFindings.map((finding) => finding.id));
              return [...partialFindings, ...current.filter((finding) => !incomingIds.has(finding.id) && !finding.live)].slice(0, 8);
            });
            if (!source) publishStreamingDiagram(buildEvidencePreviewMermaid(partialFindings), "Mapa incremental de hallazgos");
          }
          if (source) publishStreamingDiagram(source);
          const liveFinding = detectLiveFinding(streamingDraft.current);
          if (liveFinding) setAssistantFindings((current) => current.some((finding) => finding.id === liveFinding.id) ? current : [liveFinding, ...current].slice(0, 8));
        } else {
          updateProgress("Recibiendo hallazgos de OMP", "Cada hallazgo confirmado actualiza el centro y el mapa provisional.");
        }
        setActivity("OMP está analizando el proyecto…");
      } else if (event.type === "host_tool_call") {
        const tool = describeToolCall(event.call.name);
        addProgressStep({ ...tool, status: "active" });
        setActivity(tool.title);
      } else if (event.type === "message_end") {
        const streamedText = streamingDraft.current;
        const text = stringField(event.frame, "text") || streamedText;
        streamingDraft.current = "";
        setStreamingText("");
        if (text) {
          setMessages((current) => [...current, { author: "omp", text }]);
          const source = extractMermaid(text);
          const finalFindings = extractAssistantFindings(text, true, 64);
          if (finalFindings.length > 0) {
            setAssistantFindings((current) => {
              const incomingIds = new Set(finalFindings.map((finding) => finding.id));
              return [...finalFindings, ...current.filter((finding) => !incomingIds.has(finding.id))].slice(0, 64);
            });
          }
          const diagram = source ?? (finalFindings.length > 0 ? buildEvidencePreviewMermaid(finalFindings) : null);
          setAnalysisReport((current) => current ? `${current}\n\n---\n\n${text}` : text);
          void window.studio.project.saveAnalysis({ report: text, mermaid: diagram });
          setAnalysisStale(false);
          if (diagram) publishStreamingDiagram(diagram, source ? "Mapa recibido de OMP" : "Mapa incremental de hallazgos");
          streamingRevisionId.current = null;
          addProgressStep({ title: "Resultado recibido", detail: "El centro y el mapa ya tienen la respuesta completa de OMP.", status: "done" });
          setActivity("Hallazgos preparados");
        }
      } else if (event.type === "session_settled") {
        setChatStatus("settled");
        setPersonalityStatus("waiting");
        setActiveProactiveTarget(null);
        setActivity("Listo para continuar");
        setSending(false);
        const nextObjective = queuedObjective.current;
        if (nextObjective) {
          queuedObjective.current = null;
          window.setTimeout(() => void sendMessage(nextObjective.prompt, nextObjective.workflow), 0);
        }
      } else if (event.type === "warning" || event.type === "error") {
        setPersonalityStatus("waiting");
        setActiveProactiveTarget(null);
        setChatError(humanizeError(event.message));
        setActivity("No se pudo completar la tarea");
        setChatStatus("failed");
        setSending(false);
      }
    });
    void reloadProjectSurface().catch((error: unknown) => {
      setChatStatus("failed");
      setChatError(humanizeError(error));
      setBootstrapFailed(true);
      setActivity("No se pudo cargar el proyecto");
    });
    return unsubscribe;
  }, []);

  const selectedNavigation = useMemo(
    () => navigation.find((item) => item.section === section) ?? navigation[0],
    [section],
  );
  const selectedDiagramRevision = useMemo(
    () => diagramRevisions.find((revision) => revision.id === selectedDiagramRevisionId) ?? diagramRevisions.at(-1),
    [diagramRevisions, selectedDiagramRevisionId],
  );
  const latestDiagram = selectedDiagramRevision?.source ?? [...messages].reverse().map((message) => extractMermaid(message.text)).find((source): source is string => Boolean(source)) ?? storedDiagram;
  const pdacSignals = useMemo(() => {
    const patterns = {
      purpose: /propósito|frontera|producto/i,
      actors: /actor|aprendiz|operador|learner|teacher|usuario/i,
      "use-cases": /caso de uso|importar material|practicar|explorar biblioteca|worker local|playback/i,
      domains: /dominio|entidad|concepto|término|agregado|domain/i,
      journeys: /journey|recorrido|flujo|estado|workflow/i,
      rules: /regla|restric|invariant|local-first|debe|permit|historial/i,
      requirements: /requisito|requirement|criterio de aceptación|acceptance|constraint/i,
      contexts: /bounded context|contexto delimitado|instrument-specific|practice material|transcription|acquisition/i,
    } as const;
    const signalCount = (pattern: RegExp) => assistantFindings.filter((finding) => pattern.test(`${finding.title} ${finding.detail}`)).length;
    const signal = (id: string, label: string, pattern: RegExp) => ({ id, label, count: signalCount(pattern), state: signalCount(pattern) > 0 ? "found" as const : "pending" as const });
    return [
      signal("purpose", "Propósito", patterns.purpose),
      signal("actors", "Actores", patterns.actors),
      signal("use-cases", "Casos de uso", patterns["use-cases"]),
      signal("domains", "Dominio", patterns.domains),
      signal("journeys", "Journeys", patterns.journeys),
      signal("rules", "Reglas", patterns.rules),
      signal("requirements", "Requisitos", patterns.requirements),
      signal("contexts", "Bounded contexts", patterns.contexts),
    ];
  }, [assistantFindings]);
  const nextPdacSignal = pdacSignals.find((signal) => signal.state === "pending");
  const nextPdacGuidance = pdacGuidance(nextPdacSignal?.id ?? "purpose");
  const visibleFindings = useMemo(() => {
    if (pdacFocus === "all") return assistantFindings;
    const patterns: Record<Exclude<PdacFocus, "all">, RegExp> = {
      "use-cases": /caso de uso|importar material|practicar|explorar biblioteca|worker local|playback/i,
      actors: /actor|aprendiz|operador|learner|teacher|usuario/i,
      domains: /dominio|entidad|concepto|término|agregado|domain/i,
      journeys: /journey|recorrido|flujo|estado|workflow/i,
      rules: /regla|restric|invariant|local-first|debe|permit|historial/i,
      requirements: /requisito|requirement|criterio de aceptación|acceptance|constraint/i,
      contexts: /bounded context|contexto delimitado|instrument-specific|practice material|transcription|acquisition/i,
    };
    const pattern = patterns[pdacFocus];
    return assistantFindings.filter((finding) => pattern.test(`${finding.title} ${finding.detail}`));
  }, [assistantFindings, pdacFocus]);
  const domainTerms = useMemo(() => {
    const terms = extractDomainTerms(analysisReport);
    return terms.length > 0 ? terms : visibleFindings;
  }, [analysisReport, visibleFindings]);
  function openPdacPage(target: string): void {
    userSelectedPdacPage.current = true;
    const page = (target in pdacPageLabels ? target : "overview") as PdacPage;
    setPdacPage(page);
    setPdacFocus(page === "overview" ? "all" : page);
  }
  function focusWorkspace(target: "ProductShape" | "Arquitectura", page: PdacPage = "overview"): void {
    setSection(target);
    setActiveTab(target);
    if (target === "ProductShape") openPdacPage(page);
  }
  async function refreshProductShapeFocus(page: Exclude<PdacPage, "overview">): Promise<boolean> {
    setSending(true);
    setChatStatus("working");
    setChatError("");
    setActivity(`ProductShape está compilando ${pdacPageLabels[page].toLowerCase()}…`);
    try {
      const result = await window.studio.project.productshapeGraph();
      if (!result.ok) return false;
      await reloadProjectSurface();
      setActivity(`ProductShape actualizó ${pdacPageLabels[page].toLowerCase()} desde el grafo oficial.`);
      setChatStatus("settled");
      setMessages((current) => [...current, { author: "omp", text: `He actualizado ${pdacPageLabels[page].toLowerCase()} desde ProductShape. El diagrama central refleja ahora el grafo publicado.` }]);
      return true;
    } catch (error) {
      setChatError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSending(false);
    }
  }
  function reviewPdacSignal(signal: { id: string; label: string }): void {
    const page = signal.id as Exclude<PdacPage, "overview">;
    focusWorkspace("ProductShape", page);
    void (async () => {
      if (await refreshProductShapeFocus(page)) return;
      await sendMessage(pdacEntityPrompt(page), "brownfield-discovery");
    })();
  }
  function reviewCurrentPdacPage(): void {
    if (pdacPage === "overview") {
      void sendMessage(reviewPrompt("ProductShape"), "brownfield-discovery");
      return;
    }
    void (async () => {
      if (await refreshProductShapeFocus(pdacPage)) return;
      await sendMessage(pdacEntityPrompt(pdacPage), "brownfield-discovery");
    })();
  }
  function reviewNextPdacSignal(): void {
    if (nextPdacSignal && nextPdacSignal.id !== "purpose") reviewPdacSignal(nextPdacSignal);
    else {
      focusWorkspace("ProductShape");
      void sendMessage(nextPdacGuidance.prompt, "brownfield-discovery");
    }
  }
  useEffect(() => {
    if (!userSelectedPdacPage.current && section === "ProductShape" && pdacPage === "overview" && assistantFindings.length > 0 && nextPdacSignal && nextPdacSignal.id !== "purpose") {
      setPdacPage(nextPdacSignal.id);
      setPdacFocus(nextPdacSignal.id);
    }
  }, [assistantFindings.length, nextPdacSignal?.id, pdacPage, section]);
  function workflowForSection(currentSection: Section): "brownfield-discovery" | "architecture-documentation" | "architecture-planning" {
    return currentSection === "Arquitectura" ? "architecture-documentation" : "brownfield-discovery";
  }

  async function continueDiscovery(): Promise<void> {
    setBootstrapFailed(false);
    setChatError("");
    setSending(true);
    setActivity("Reanudando el descubrimiento…");
    try {
      await window.studio.project.bootstrap({ resume: true });
    } catch (error) {
      setBootstrapFailed(true);
      setSending(false);
      setChatError(humanizeError(error));
      setActivity("No se pudo reanudar el descubrimiento");
    }
  }
  async function sendMessage(prompt?: string, requestedWorkflow?: "brownfield-discovery" | "architecture-documentation" | "architecture-planning", proactiveLabel?: string): Promise<void> {
    const text = (prompt ?? chatInput).trim();
    if (!text) return;
    const workflow = requestedWorkflow ?? workflowForSection(section);
    if (workflow === "brownfield-discovery") focusWorkspace("ProductShape", pdacPage);
    else if (workflow === "architecture-documentation") focusWorkspace("Arquitectura");
    if (!proactiveLabel) setActiveProactiveTarget(null);
    lastInteractionAt.current = Date.now();
    if (prompt === undefined) setMessages((current) => [...current, { author: "user", text }]);
    setChatInput("");
    setChatError("");
    streamingDraft.current = "";
    setStreamingText("");
    beginProgress();
    if (proactiveLabel) {
      setProgressSteps([{ id: "proactive", title: `Continuando con ${proactiveLabel}`, detail: "La personalidad ha elegido este foco y OMP está trabajando en él.", status: "active" }]);
      setActivity(`Sigo con ${proactiveLabel}…`);
    } else {
      setActivity("Preparando la tarea…");
    }
    setSending(true);
    try {
      await window.studio.command.submit({ workflow, prompt: text });
    } catch (error) {
      setSending(false);
      setActiveProactiveTarget(null);
      setChatError(humanizeError(error));
      setChatStatus("failed");
      setActivity("No se pudo iniciar la tarea");
    }
  }
  function chooseObjective(prompt: string, workflow: "brownfield-discovery" | "architecture-documentation", objective: "understand" | "architecture" | "greenfield"): void {
    setSelectedObjective(objective);
    focusWorkspace(workflow === "architecture-documentation" ? "Arquitectura" : "ProductShape");
    if (sending) {
      queuedObjective.current = { prompt, workflow };
      setActivity("Objetivo preparado; comenzará cuando termine el análisis actual…");
      return;
    }
    void sendMessage(prompt, workflow);
  }
  async function openProject(): Promise<void> {
    const result = await window.studio.projects.open();
    if (result) await reloadProjectSurface();
  }

  async function activateProject(id: string): Promise<void> {
    if (!id || id === activeProjectId) return;
    await window.studio.projects.activate(id);
    setMessages(initialMessages);
    setPdacPage("overview");
    setPdacFocus("all");
    await reloadProjectSurface();
  }

  async function archiveActiveProject(): Promise<void> {
    if (!activeProjectId) return;
    await window.studio.projects.archive(activeProjectId);
    setMessages(initialMessages);
    setPdacPage("overview");
    setPdacFocus("all");
    await reloadProjectSurface();
  }
  sendMessageRef.current = sendMessage;
  useEffect(() => {
    if (section !== "ProductShape" || assistantFindings.length === 0) return;
    const intervalMs = Math.max(250, Math.min(5_000, personalityIdleMs / 4));
    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastInteractionAt.current;
      const sinceReview = Date.now() - lastProactiveReviewAt.current;
      if (!sending && !chatInput.trim() && idleFor >= personalityIdleMs && sinceReview >= personalityIdleMs) {
        lastProactiveReviewAt.current = Date.now();
        setPersonalityStatus("working");
        const pdacComplete = pdacSignals.length > 0 && pdacSignals.every((signal) => signal.state === "found");
        const targetSignal = nextPdacSignal;
        const targetLabel = targetSignal?.label ?? (pdacComplete ? "la siguiente decisión de arquitectura" : pdacPageLabels[pdacPage]);
        const targetPrompt = targetSignal
          ? targetSignal.id === "purpose" ? nextPdacGuidance.prompt : pdacEntityPrompt(targetSignal.id)
          : pdacComplete
            ? "PDAC COMPLETO: todos los focos visibles tienen hallazgos. Continúa con el siguiente trabajo de arquitectura sin modificar archivos: documenta la arquitectura existente si hay evidencia, o plantea una primera arquitectura candidata si es Greenfield. Separa hechos, decisiones e incógnitas y termina con una decisión concreta que el usuario pueda revisar."
            : projectMode === "greenfield"
              ? "REVISIÓN PROACTIVA GREENFIELD: revisa el caso de uso y los hechos, inferencias e incógnitas ya confirmados. Propón sólo la siguiente pregunta concreta que desbloquee el diseño PDAC. No inventes actores, reglas ni respuestas y no repitas el informe completo."
              : "REVISIÓN PROACTIVA BROWNFIELD: repasa los hallazgos PDAC existentes, busca contradicciones, cambios recientes o incógnitas que bloqueen una decisión. Devuelve como máximo tres observaciones y una pregunta concreta. No inventes datos ni repitas el informe completo.";
        const workflow = pdacComplete ? (projectMode === "greenfield" ? "architecture-planning" : "architecture-documentation") : "brownfield-discovery";
        setActiveProactiveTarget({ label: targetLabel });
        setMessages((current) => [...current, { author: "omp", text: `Sigo con ${targetLabel}. He elegido este foco para continuar el trabajo mientras no estás interactuando.` }]);
        void sendMessageRef.current?.(targetPrompt, workflow, targetLabel);
        if (targetSignal && targetSignal.id in pdacPageLabels) focusWorkspace("ProductShape", targetSignal.id as PdacPage);
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [assistantFindings.length, chatInput, pdacSignals, personalityIdleMs, projectMode, section, sending]);
  const suggestionsLocked = sending || personalityStatus === "working";


  return (
    <div className={`app-shell ${theme} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} onPointerDown={() => { lastInteractionAt.current = Date.now(); }}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-name">ProjectStudio</div>
            <div className="brand-subtitle">constructor visual local-first</div>
          </div>
        </div>
        <label className="project-picker">
          <span>Proyecto</span>
          <select value={activeProjectId} aria-label="Proyecto activo" onChange={(event) => void activateProject(event.target.value)}>
            {projects.length === 0 && <option value="">Cargando proyectos…</option>}
            {projects.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}{candidate.archived ? " · archivado" : ""}</option>)}
          </select>
        </label>
        <div className="project-actions">
          <button className="quiet-button" onClick={() => void openProject()} title="Añadir o crear referencia a un proyecto local">＋</button>
          <button className="quiet-button" onClick={() => void archiveActiveProject()} title="Archivar referencia; no borra archivos">⌫</button>
        </div>
        <div className="topbar-context">
          <span className="status-dot" />
          <span>main · limpio</span>
          <span className="context-divider" />
          <span className="mode-pill">Explorar</span>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Cambiar tema">
            {theme === "dark" ? "☼" : "☾"}
          </button>
          <button className="avatar" aria-label="Perfil local">LC</button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`} aria-label="Navegación del proyecto">
          <div className="sidebar-heading">
            <span>EXPLORADOR</span>
            <button className="quiet-button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? "Expandir explorador" : "Contraer explorador"}>{sidebarCollapsed ? "›" : "‹"}</button>
          </div>
          <div className="workspace-tree">
            <div className="tree-root"><span className="tree-chevron">⌄</span><span className="folder-icon">▰</span>{project.split(" · ")[0]}</div>
            <div className="tree-branch"><span>◌</span> cwd configurado por entorno</div>
            <div className="tree-signals">
              {projects.find((candidate) => candidate.id === activeProjectId)?.detected.productShape && <span>ProductShape detectado</span>}
              {projects.find((candidate) => candidate.id === activeProjectId)?.detected.architecture && <span>Arquitectura detectada</span>}
            </div>
          </div>
          <div className="project-manager">
            <div className="sidebar-heading project-manager-heading"><span>PROYECTOS</span><button className="quiet-button" onClick={() => void openProject()} aria-label="Añadir proyecto">＋</button></div>
            <div className="project-list">
              {projects.map((candidate) => (
                <button className={`project-row ${candidate.id === activeProjectId ? "active" : ""} ${candidate.archived ? "archived" : ""}`} key={candidate.id} onClick={() => void activateProject(candidate.id)} title={candidate.path}>
                  <span className="project-row-dot" /> <span>{candidate.name}</span><small>{candidate.archived ? "archivado" : candidate.detected.productShape ? "ProductShape" : "local"}</small>
                </button>
              ))}
            </div>
          </div>
          <nav className="nav-list">
            <div className="sidebar-heading section-heading"><span>VISTAS</span></div>
            {navigation.map((item) => (
              <button
                className={`nav-item ${section === item.section ? "selected" : ""}`}
                key={item.section}
                onClick={() => { setSection(item.section); setActiveTab(item.section); }}
                title={item.detail}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.section}</span>
                {item.section === "Evidencia" && <span className="nav-count">12</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className="connection-card">
              <span className="connection-icon">⌁</span>
              <div><strong>{chatMode === "real" ? "OMP real" : "OMP emulado"}</strong><small>estado · {displayChatStatus(chatStatus)}</small></div>
            </div>
            <div className="phase-label">FASE 04 · CHAT</div>
          </div>
        </aside>

        <main className="main-panel">
          <div className="tab-strip" role="tablist" aria-label="Vistas abiertas">
            {["Resumen", "ProductShape", "Arquitectura"].map((tab) => (
              <button className={`view-tab ${activeTab === tab ? "active" : ""}`} key={tab} onClick={() => { setActiveTab(tab); setSection(tab as Section); }} role="tab" aria-selected={activeTab === tab}>
                <span className="tab-status">{tab === "Resumen" ? "●" : "◇"}</span>{tab}<span className="tab-close">×</span>
              </button>
            ))}
            <button className="add-tab" aria-label="Abrir vista">+</button>
          </div>
          <div className="content-scroll">
            <div className="breadcrumb"><span>{project.split(" · ")[0]}</span><span>/</span><strong>{section === "ProductShape" ? pdacPageLabels[pdacPage] : selectedNavigation.section}</strong><span className="breadcrumb-spacer" /><span className="revision-label">OMP real · cwd activo</span></div>
            {section !== "ProductShape" && <section className="welcome-strip">
              <div className="welcome-icon">✦</div>
              <div>
                <strong>{sending ? progressSteps.at(-1)?.title ?? "Descubrimiento en curso" : "Siguiente paso recomendado"}</strong>
                <span>{sending ? progressSteps.at(-1)?.detail ?? activity : `${activity}. Puedes revisar evidencias mientras el workflow continúa.`}</span>
              </div>
              {bootstrapFailed
                ? <button className="outline-button" onClick={() => void continueDiscovery()}>Continuar análisis</button>
                : !sending && <span className="suggestion-note">El Arquitecto de Proyecto te propone objetivos en el chat.</span>}
            </section>}
            {section !== "ProductShape" && <section className="hero-section">
              <div>
                <div className="eyebrow">PROYECTO LOCAL · INSPECCIÓN REAL</div>
                <h1>{selectedNavigation.section === "Resumen" ? "Tu producto, en contexto" : selectedNavigation.section}</h1>
                <p>{`${selectedNavigation.detail}. El chat usa OMP real con el cwd del proyecto seleccionado.`}</p>
              </div>
              {section === "Arquitectura"
                ? <button className="outline-button primary-review" onClick={() => void sendMessage(reviewPrompt(section))}>Revisar arquitectura</button>
                : <button className="outline-button" onClick={() => setActiveTab("Resumen")}>Ver resumen</button>}
            </section>}
            {section === "ProductShape" ? (
              <section className={`pdac-workbench pdac-artifact-screen ${pdacPage === "overview" ? "overview-screen" : `${pdacPage}-screen`}`}>
                <nav className="pdac-artifact-nav" aria-label="Secciones PDAC"><div className="pdac-artifact-links">{pdacSignals.map((signal) => <button className={`pdac-artifact-button ${signal.state} ${pdacPage === signal.id ? "selected" : ""}`} key={signal.id} onClick={() => { userSelectedPdacPage.current = true; openPdacPage(signal.id); }} aria-label={signal.label} aria-pressed={pdacPage === signal.id} title={`${signal.label} · ${signal.count} hallazgo${signal.count === 1 ? "" : "s"}`}><span className="pdac-artifact-icon">{signal.id === "purpose" ? "◎" : signal.id === "actors" ? "♙" : signal.id === "use-cases" ? "◇" : signal.id === "domains" ? "◈" : signal.id === "journeys" ? "↝" : signal.id === "rules" ? "§" : signal.id === "requirements" ? "✓" : "◌"}</span><span className="pdac-artifact-count">{signal.count}</span><span className="pdac-artifact-label">{signal.label}</span></button>)}</div><span className={`pdac-surface-mode ${sending ? "live" : "stored"}`}>{sending ? "EN VIVO" : analysisStale ? "CAMBIOS" : "GUARDADO"}</span><button className="outline-button primary-review compact-review" onClick={() => void sendMessage(projectMode === "greenfield" ? "Quiero empezar la entrevista del primer caso de uso." : reviewPrompt("ProductShape"), "brownfield-discovery")}>{projectMode === "greenfield" ? "Empezar" : "Revisar"}</button></nav>
                {sending && <div className="pdac-activity-line" aria-live="polite"><span className="activity-spinner" aria-label="OMP trabajando" /><strong>{progressSteps.at(-1)?.title ?? "Preparando la inspección"}</strong><small>{progressSteps.at(-1)?.detail ?? "El workflow está comenzando."}</small></div>}
                {pdacPage !== "overview" && <article className="panel-card pdac-entity-banner"><div><div className="card-kicker">{sending ? "VISTA DINÁMICA · TRABAJO ACTUAL" : "VISTA ESTÁTICA · EVIDENCIA PDAC"}</div><h2>{pdacPageLabels[pdacPage]}</h2><p>{sending ? `Estoy trabajando sólo el foco ${pdacPageLabels[pdacPage].toLowerCase()}. El mapa y los hallazgos se actualizarán aquí sin mezclar otras áreas.` : `Esta es la evidencia guardada para ${pdacPageLabels[pdacPage].toLowerCase()}. Puedes volver al estado general cuando quieras.`}</p><div className="pdac-entity-count">{visibleFindings.length} hallazgo{visibleFindings.length === 1 ? "" : "s"} visible{sending ? " · actualizando" : ""}</div></div><div className="pdac-entity-actions"><button className="outline-button primary-review" onClick={() => reviewCurrentPdacPage()}>{sending ? "Analizando…" : `Actualizar ${pdacPageLabels[pdacPage].toLowerCase()}`}</button><button className="outline-button" onClick={() => openPdacPage("overview")}>← Estado general</button></div></article>}
                <article className="panel-card pdac-diagram-card">
                  <div className="card-heading"><div><div className="card-kicker">{latestDiagram || assistantFindings.length > 0 ? (selectedDiagramRevision?.status === "provisional" ? "MAPA PDAC · PROVISIONAL" : "MAPA PDAC · EVIDENCIA") : "MAPA PDAC · ESPERANDO EVIDENCIA"} </div><h2>{assistantFindings.length > 0 ? "Mapa editable de hallazgos" : latestDiagram ? pdacPage === "overview" ? selectedDiagramRevision?.label === "Mapa incremental de hallazgos" ? "Hallazgos que ya forman el mapa" : "Relaciones encontradas" : `Mapa de ${pdacPageLabels[pdacPage].toLowerCase()}` : "El mapa aparecerá aquí"}</h2></div><span className="live-badge"><span className={sending ? "active" : ""} />{sending ? "ACTUALIZANDO" : "LIVE"}</span></div>
                  {diagramRevisions.length > 1 && <div className="diagram-revisions" aria-label="Revisiones del mapa PDAC">{diagramRevisions.map((revision, index) => <button className={revision.id === selectedDiagramRevisionId ? "selected" : ""} key={revision.id} onClick={() => setSelectedDiagramRevisionId(revision.id)}>{revision.status === "provisional" ? "Provisional" : "Guardado"} {index + 1}</button>)}</div>}
                  {pdacPage !== "overview" ? <PdacCanvas key={`${activeProjectId}-${pdacPage}`} projectId={activeProjectId} page={pdacPage} findings={visibleFindings} /> : assistantFindings.length > 0 ? <PdacCanvas key={`${activeProjectId}-overview`} projectId={activeProjectId} page="overview" findings={assistantFindings} /> : latestDiagram ? <div className="system-map generated-system-map"><DiagramVisual source={latestDiagram} canvas /></div> : <div className="system-map diagram-placeholder"><span className="placeholder-icon">{sending ? "◌" : "◇"}</span><strong>{sending ? "Construyendo relaciones…" : "Todavía no hay un diagrama publicado"}</strong><small>{sending ? "El mapa se actualizará cuando el asistente encuentre relaciones confirmables." : "Revisar y diagramar inicia el análisis con evidencia real."}</small></div>}
                  <button className="card-link" onClick={() => reviewCurrentPdacPage()}>{sending ? "Actualizando mapa…" : pdacPage === "overview" ? "Actualizar mapa con OMP" : `Actualizar mapa de ${pdacPageLabels[pdacPage].toLowerCase()}`} <span>→</span></button>
                </article>
                {pdacPage === "domains" && <article className="panel-card pdac-domain-glossary"><div className="card-heading"><div><div className="card-kicker">GLOSARIO DEL DOMINIO · EVIDENCIA</div><h2>Términos y significado</h2></div><span className="pdac-entity-count">{domainTerms.length} término{domainTerms.length === 1 ? "" : "s"}</span></div><div className="pdac-glossary-grid">{domainTerms.length > 0 ? domainTerms.map((term) => <div className="pdac-glossary-term" key={term.id}><strong>{term.title}</strong><p>{term.detail}</p>{term.evidence && <small>{term.evidence}</small>}</div>) : <div className="assistant-empty"><strong>Aún no hay términos confirmados.</strong><small>Actualiza el foco Dominio con OMP para construir este glosario.</small></div>}</div></article>}
                {pdacPage === "overview" && <article className="panel-card pdac-details-card">
                  <div className="card-heading"><div><div className="card-kicker">DETALLE DINÁMICO</div><h2>Lo que va encontrando</h2></div><button className="pdac-clear-focus" onClick={() => openPdacPage("overview")}>Ver estado</button></div>
                  <div className="pdac-detail-list" aria-live="polite">
                    {visibleFindings.length > 0 ? visibleFindings.slice(0, 8).map((finding, index) => <div className={`pdac-detail-row ${finding.live ? "live" : ""}`} key={finding.id}><span className="pdac-detail-index">{String(index + 1).padStart(2, "0")}</span><div><div className="pdac-detail-title"><span className={`pdac-kind-badge ${finding.kind ?? "fact"}`}>{finding.kind === "inference" ? "INFERENCIA" : finding.kind === "unknown" ? "PENDIENTE" : "HECHO"}</span><strong>{finding.title}</strong>{finding.live && <span className="pdac-new-badge">NUEVO</span>}</div><small>{finding.detail}{finding.evidence ? ` · ${finding.evidence}` : ""}</small></div></div>) : <div className="assistant-empty"><strong>{sending ? "Esperando el siguiente hallazgo…" : "Esta área todavía no tiene evidencia."}</strong><small>{sending ? "OMP la añadirá cuando encuentre una señal verificable." : "El asistente la completará cuando encuentre información verificable en el proyecto."}</small></div>}
                  </div>
                </article>}
              </section>
            ) : (
              <>
            <section className="metric-grid" aria-label="Resumen del proyecto">
              <article className="metric-card accent-card"><div className="metric-label">CASOS DE USO</div><div className="metric-value">08</div><div className="metric-note positive">↑ 2 esta semana</div></article>
              <article className="metric-card"><div className="metric-label">COMPONENTES C4</div><div className="metric-value">14</div><div className="metric-note">3 con evidencia nueva</div></article>
              <article className="metric-card"><div className="metric-label">EVIDENCIAS</div><div className="metric-value">12</div><div className="metric-note">último hallazgo hace 4 min</div></article>
              <article className="metric-card"><div className="metric-label">CAMBIOS PENDIENTES</div><div className="metric-value">02</div><div className="metric-note warning">requieren revisión</div></article>
            </section>
            <section className={`dashboard-grid ${section === "ProductShape" ? "productshape-dashboard" : ""}`}>
              <article className="panel-card architecture-card">
                <div className="card-heading"><div><div className="card-kicker">{latestDiagram ? (selectedDiagramRevision?.status === "provisional" ? "VISTA PROVISIONAL · PRODUCTSHAPE" : "EVIDENCIA GUARDADA") : "PRODUCTSHAPE · INSPECCIÓN REAL"}</div><h2>{assistantFindings.length > 0 ? "Mapa editable de hallazgos" : latestDiagram ? "Mapa de relaciones" : "Mapa pendiente de evidencia"}</h2></div><span className="live-badge"><span className={sending ? "active" : ""} />{sending ? "ACTUALIZANDO" : "LIVE"}</span></div>
                {diagramRevisions.length > 1 && <div className="diagram-revisions" aria-label="Revisiones temporales del diagrama">{diagramRevisions.map((revision, index) => <button className={revision.id === selectedDiagramRevisionId ? "selected" : ""} key={revision.id} onClick={() => setSelectedDiagramRevisionId(revision.id)}>{revision.status === "provisional" ? "Provisional" : "Guardado"} {index + 1}</button>)}</div>}
                {assistantFindings.length > 0
                  ? <PdacCanvas projectId={activeProjectId} page="overview" findings={assistantFindings} />
                  : latestDiagram
                    ? <div className="system-map generated-system-map"><DiagramVisual source={latestDiagram} canvas /></div>
                    : <div className="system-map diagram-placeholder">
                      <span className="placeholder-icon">{sending ? "◌" : "◇"}</span>
                      <strong>{sending ? "El asistente está construyendo el mapa…" : "Todavía no hay un diagrama publicado"}</strong>
                      <small>{sending ? "Aparecerá en cuanto OMP entregue una relación coherente." : "Revisa y diagramar iniciará una inspección con evidencia real."}</small>
                    </div>}
                <button className="card-link" onClick={() => { setSection("Arquitectura"); setActiveTab("Arquitectura"); void sendMessage(reviewPrompt("Arquitectura")); }}>Pedir diagrama real <span>→</span></button>
              </article>
            </section>
              </>
            )}
          </div>
        </main>

        <aside className="chat-panel" aria-label="Chat OMP" data-chat-status={chatStatus}>
          <div className="chat-header"><div><div className="chat-title"><span className="omp-orbit">✦</span> OMP <span className="chat-live">REAL</span></div><div className="chat-context">contexto: {section.toLowerCase()} · {displayChatStatus(chatStatus)}</div></div><button className="quiet-button" aria-label="Opciones del chat">•••</button></div>
          <div className="chat-messages" ref={chatMessagesRef} aria-live="polite">
            <div className="chat-date">HOY · SESIÓN ACTIVA</div>
            {messages.map((message, index) => <div className={`message-row ${message.author}`} key={`${message.author}-${index}`}><div className="message-avatar">{message.author === "omp" ? "✦" : "LC"}</div><div className={`message-bubble ${message.streaming ? "streaming" : ""}`}><div className="message-author">{message.author === "omp" ? "OMP" : "TÚ"}</div>{message.author === "omp" ? <AssistantContent text={message.text || (message.streaming ? "…" : "")} /> : message.text}</div></div>)}
            {sending && streamingText && <div className="message-row omp streaming"><div className="message-avatar">✦</div><div className="message-bubble streaming"><div className="message-author">OMP · en curso</div><AssistantContent text={streamingText} /></div></div>}
          </div>
          <div className="chat-suggestions" aria-label="Objetivos sugeridos">
            <div className="chat-suggestions-label">{projectMode === "greenfield" && assistantFindings.length === 0 ? "Siguiente decisión" : pdacPage !== "overview" ? `Foco actual · ${pdacPageLabels[pdacPage]}` : assistantFindings.length > 0 ? "Siguiente foco PDAC" : "Te sugiero empezar por"}</div>
            <div className="chat-suggestions-grid">
              {projectMode === "greenfield" && assistantFindings.length === 0
                ? <button disabled={suggestionsLocked} onClick={() => chooseObjective("Quiero empezar la entrevista del primer caso de uso.", "brownfield-discovery", "greenfield")}>Definir primer caso de uso</button>
                : pdacPage !== "overview"
                  ? <><button disabled={suggestionsLocked} onClick={() => void sendMessage(pdacEntityPrompt(pdacPage), "brownfield-discovery")}>Refinar {pdacPageLabels[pdacPage].toLowerCase()}</button>{nextPdacSignal && nextPdacSignal.id !== pdacPage && <button disabled={suggestionsLocked} onClick={() => reviewNextPdacSignal()}>Siguiente: {nextPdacSignal.label.toLowerCase()}</button>}</>
                  : assistantFindings.length > 0
                    ? <><button disabled={suggestionsLocked} onClick={() => reviewNextPdacSignal()}>{nextPdacSignal ? `Revisar ${nextPdacSignal.label.toLowerCase()}` : "Revisar el siguiente foco"}</button><button disabled={suggestionsLocked} onClick={() => setChatInput("¿Qué contradicciones o incógnitas quedan en el PDAC?")}>Preguntar por pendientes</button></>
                    : selectedObjective
                      ? <div className="selected-objective" role="status"><span className="selected-objective-check">✓</span><div><strong>{selectedObjective === "understand" ? "Entender el proyecto" : selectedObjective === "architecture" ? "Documentar arquitectura" : "Definir primer caso de uso"}</strong><small>{sending ? "En curso · el resultado aparecerá en el centro." : "Elegido · puedes continuar con una pregunta en el chat."}</small></div></div>
                      : <><button disabled={suggestionsLocked} onClick={() => chooseObjective("Analiza este proyecto como brownfield: empieza por docs/product y después contrasta con el código. Devuelve hechos, inferencias, incógnitas y un diagrama confirmado.", "brownfield-discovery", "understand")}>Entender el proyecto</button><button disabled={suggestionsLocked} onClick={() => chooseObjective("Documenta la arquitectura existente a partir de ProductShape, src/ y tests.", "architecture-documentation", "architecture")}>Documentar arquitectura</button></>}
            </div>
          </div>
          {chatError && <div className="chat-error" role="alert">{chatError}</div>}
          <div className="chat-composer"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Pregunta sobre este proyecto…" aria-label="Mensaje para OMP" rows={3} /><div className="composer-footer"><span className="composer-hint">{sending ? "Tarea en curso…" : "↵ enviar · ⇧↵ nueva línea"}</span><button className="send-button" onClick={() => void sendMessage()} aria-label="Enviar mensaje">↑</button></div></div>
          <div className="chat-footer"><span className="safe-dot" /> Sesión local · {displayChatStatus(chatStatus)} <span className="personality-status" data-personality-status={personalityStatus} data-proactive-target={personalityStatus === "working" ? activeProactiveTarget?.label : undefined} aria-live="polite">✦ Personalidad {personalityStatus === "working" ? activeProactiveTarget ? `trabajando en ${activeProactiveTarget.label}` : "trabajando" : "en espera"}</span>{personalityCountdownMs > 0 && <span className="personality-countdown" role="status" aria-live="polite">continúa en {Math.ceil(personalityCountdownMs / 1000)}s</span>}<label className="personality-setting">inactividad <select aria-label="Tiempo de inactividad de la personalidad" value={personalityIdleMs} onChange={(event) => { const milliseconds = Number(event.currentTarget.value); setPersonalityIdleMs(milliseconds); localStorage.setItem(personalityIdleStorageKey, String(milliseconds)); lastProactiveReviewAt.current = 0; lastInteractionAt.current = Date.now(); }}><option value={10_000}>10s</option><option value={20_000}>20s</option><option value={60_000}>1m</option><option value={300_000}>5m</option><option value={900_000}>15m</option></select></label><span className="footer-spacer" /><span>ProjectStudio</span></div>
        </aside>
      </div>
      <footer className="statusbar"><span><span className="status-dot" /> Proyecto listo</span><span>8 casos de uso</span><span>12 evidencias</span><span>rama main</span><span className="statusbar-spacer" /><span>Fase 04 · chat RPC</span></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
