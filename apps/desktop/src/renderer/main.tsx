import React, { StrictMode, useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { extractMermaid, layoutDiagram, parseMermaid } from "./diagrams.js";
import { visibleTextDelta } from "./chat-events.js";
type Message = { author: "user" | "omp"; text: string; streaming?: boolean };
type DiagramRevision = { id: string; source: string; label: string; status: "stored" | "provisional"; createdAt: string };
type AssistantFinding = { id: string; title: string; detail: string; evidence?: string; live?: boolean };
type PdacPage = "overview" | "use-cases" | "actors" | "rules" | "contexts";
type PdacFocus = "all" | "use-cases" | "actors" | "rules" | "contexts";
const pdacPageLabels: Record<PdacPage, string> = { overview: "ProductShape", "use-cases": "Casos de uso", actors: "Actores", rules: "Reglas y restricciones", contexts: "Bounded contexts" };

function extractAssistantFindings(text: string): AssistantFinding[] {
  const withoutDiagram = text.replace(/```[\s\S]*?```/g, "");
  const normalized = withoutDiagram.replace(/\s+(?=#{1,3}\s+)/g, "\n");
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const findings: AssistantFinding[] = [];
  for (let index = 0; index < lines.length && findings.length < 4; index += 1) {
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
    findings.push({ id: `${Date.now()}-${findings.length}`, title, detail: (detail ?? "Hallazgo publicado por el asistente.").slice(0, 180), evidence });
  }
  if (findings.length > 0) return findings;
  const summary = withoutDiagram.replace(/\s+/g, " ").trim();
  return summary ? [{ id: `${Date.now()}-summary`, title: "Resultado de la revisión", detail: summary.slice(0, 180) }] : [];
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

function reviewPrompt(section: Section): string {
  if (section === "ProductShape") return "PRODUCTSHAPE: analiza el producto usando primero docs/product y después el código para corroborar. Extrae propósito, actores, casos de uso, bounded contexts, reglas y restricciones. Devuelve hallazgos con rutas verificables y un único bloque Mermaid flowchart LR confirmado. No inventes componentes.";
  if (section === "Arquitectura") return "ARCHITECTURE: inspecciona src/ y tests/ reales del proyecto. Describe componentes, entradas, salidas, persistencia y relaciones confirmadas. Devuelve hallazgos con rutas verificables y un único bloque Mermaid flowchart LR confirmado. No inventes componentes.";
  return "Revisa el proyecto seleccionado y genera hallazgos verificables y un diagrama Mermaid basado sólo en el código real.";
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

function AssistantContent({ text }: { text: string }): JSX.Element {
  const source = extractMermaid(text);
  if (!source) return <>{text}</>;
  const match = /```mermaid\\s*\\n([\\s\\S]*?)```/i.exec(text);
  const before = match ? text.slice(0, match.index) : text;
  const after = match ? text.slice((match.index ?? 0) + match[0].length) : "";
  return <>{before}<DiagramVisual source={source} />{after}</>;
}
function stringField(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === "string" ? value[key] as string : undefined;
}
function displayChatStatus(status: string): string {
  if (status === "ready" || status === "settled") return "listo";
  if (status === "failed") return "requiere atención";
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
  const [section, setSection] = useState<Section>("Resumen");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [project, setProject] = useState("proyecto · configurando");
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
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
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const streamingDraft = useRef("");
  const [sending, setSending] = useState(false);
  const queuedObjective = useRef<{ prompt: string; workflow: "brownfield-discovery" | "architecture-documentation" | "architecture-planning" } | null>(null);
  const streamingRevisionId = useRef<string | null>(null);
  function publishStreamingDiagram(source: string): void {
    const revisionId = streamingRevisionId.current ?? `streaming-${Date.now()}`;
    streamingRevisionId.current = revisionId;
    const revision: DiagramRevision = { id: revisionId, source, label: "Vista provisional en directo", status: "provisional", createdAt: "generándose ahora" };
    setDiagramRevisions((current) => {
      const existing = current.some((candidate) => candidate.id === revisionId);
      return existing ? current.map((candidate) => candidate.id === revisionId ? revision : candidate) : [...current, revision].slice(-12);
    });
    setSelectedDiagramRevisionId(revisionId);
  }

  async function reloadProjectSurface(): Promise<void> {
    setChatError("");
    setBootstrapFailed(false);
    const registry = await window.studio.projects.list();
    setProjects(registry.projects);
    const active = registry.projects.find((candidate) => candidate.id === registry.activeId);
    if (active) {
      setActiveProjectId(active.id);
      setProject(`${active.name} · ${active.archived ? "archivado" : "cwd configurado"}`);
    }
    const analysis = await window.studio.project.analysis();
    setStoredDiagram(analysis.mermaid);
    setAssistantFindings(analysis.report ? extractAssistantFindings(analysis.report) : []);
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
    setProject(`${result.projectName} · cwd configurado`);
    if (result.error) setChatError(humanizeError(result.error));
    const bootstrap = await window.studio.project.bootstrap({ resume: false });
    if (bootstrap.status === "running") {
      setSending(true);
      setActivity("Descubrimiento inicial en curso…");
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
        if (event.status === "starting") setActivity("Conectando con OMP…");
      } else if (event.type === "ready") {
        setChatStatus("ready");
        setActivity("Listo para continuar");
      } else if (event.type === "message_update") {
        const delta = visibleTextDelta(event.frame);
        if (delta) {
          streamingDraft.current += delta;
          const source = extractMermaid(streamingDraft.current);
          if (source) publishStreamingDiagram(source);
          const liveFinding = detectLiveFinding(streamingDraft.current);
          if (liveFinding) setAssistantFindings((current) => current.some((finding) => finding.id === liveFinding.id) ? current : [liveFinding, ...current].slice(0, 8));
        }
        setActivity("OMP está analizando el proyecto…");
      } else if (event.type === "host_tool_call") {
        setActivity("ProjectStudio está preparando una actualización…");
      } else if (event.type === "message_end") {
        const text = stringField(event.frame, "text") ?? streamingDraft.current;
        streamingDraft.current = "";
        if (text) {
          setMessages((current) => [...current, { author: "omp", text }]);
          setAssistantFindings((current) => [...extractAssistantFindings(text), ...current.filter((finding) => !finding.live)].slice(0, 8));
          const source = extractMermaid(text);
          if (source) publishStreamingDiagram(source);
          streamingRevisionId.current = null;
          setActivity("Hallazgos preparados");
        }
      } else if (event.type === "session_settled") {
        setChatStatus("settled");
        setActivity("Listo para continuar");
        setSending(false);
        const nextObjective = queuedObjective.current;
        if (nextObjective) {
          queuedObjective.current = null;
          window.setTimeout(() => void sendMessage(nextObjective.prompt, nextObjective.workflow), 0);
        }
      } else if (event.type === "warning" || event.type === "error") {
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
    const text = assistantFindings.map((finding) => `${finding.title} ${finding.detail}`).join(" ").toLowerCase();
    return [
      { id: "purpose", label: "Propósito", state: /propósito|frontera|producto/.test(text) ? "found" : "pending" },
      { id: "actors", label: "Actores", state: /actor|aprendiz|operador/.test(text) ? "found" : "pending" },
      { id: "use-cases", label: "Casos de uso", state: /caso de uso|importar material|practicar|explorar biblioteca/.test(text) ? "found" : "pending" },
      { id: "rules", label: "Reglas y restricciones", state: /regla|restric|invariant|local-first/.test(text) ? "found" : "pending" },
      { id: "contexts", label: "Bounded contexts", state: /bounded context|contexto delimitado|instrument-specific|practice material/.test(text) ? "found" : "pending" },
    ] as const;
  }, [assistantFindings]);
  const visibleFindings = useMemo(() => {
    if (pdacFocus === "all") return assistantFindings;
    const patterns: Record<Exclude<PdacFocus, "all">, RegExp> = {
      "use-cases": /caso de uso|importar material|practicar|explorar biblioteca/i,
      actors: /actor|aprendiz|operador/i,
      rules: /regla|restric|invariant|local-first/i,
      contexts: /bounded context|contexto delimitado|instrument-specific|practice material/i,
    };
    const pattern = patterns[pdacFocus];
    return assistantFindings.filter((finding) => pattern.test(`${finding.title} ${finding.detail}`));
  }, [assistantFindings, pdacFocus]);
  const pdacState = sending ? "Exploración en curso" : assistantFindings.length > 0 ? "Borrador PDAC provisional" : "Sin evidencia publicada";
  const pdacStateDetail = sending
    ? "El asistente está contrastando ProductShape con el código y publicará cambios parciales."
    : assistantFindings.length > 0
      ? "La vista resume evidencia encontrada; todavía no es el modelo canónico aprobado."
      : "Inicia una revisión para construir el primer estado PDAC con evidencia.";
  function openPdacPage(target: string): void {
    const page = (target in pdacPageLabels ? target : "overview") as PdacPage;
    setPdacPage(page);
    setPdacFocus(page === "overview" ? "all" : page);
  }
  function workflowForSection(currentSection: Section): "brownfield-discovery" | "architecture-documentation" | "architecture-planning" {
    return currentSection === "ProductShape" ? "brownfield-discovery" : "architecture-documentation";
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

  async function sendMessage(prompt?: string, requestedWorkflow?: "brownfield-discovery" | "architecture-documentation" | "architecture-planning"): Promise<void> {
    const text = (prompt ?? chatInput).trim();
    if (!text) return;
    setMessages((current) => [...current, { author: "user", text }]);
    setChatInput("");
    setChatError("");
    streamingRevisionId.current = null;
    setSending(true);
    setActivity("Preparando la tarea…");
    try {
      await window.studio.command.submit({ workflow: requestedWorkflow ?? workflowForSection(section), prompt: text });
    } catch (error) {
      setSending(false);
      setChatError(humanizeError(error));
      setChatStatus("failed");
      setActivity("No se pudo iniciar la tarea");
    }
  }
  function chooseObjective(prompt: string, workflow: "brownfield-discovery" | "architecture-documentation"): void {
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

  return (
    <div className={`app-shell ${theme}`}>
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
        <aside className="sidebar" aria-label="Navegación del proyecto">
          <div className="sidebar-heading">
            <span>EXPLORADOR</span>
            <button className="quiet-button" aria-label="Contraer explorador">‹</button>
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
            <section className="welcome-strip">
              <div className="welcome-icon">✦</div>
              <div>
                <strong>{sending ? "Descubrimiento en curso" : "Siguiente paso recomendado"}</strong>
                <span>{activity}. Puedes revisar evidencias mientras el workflow continúa.</span>
              </div>
              {bootstrapFailed
                ? <button className="outline-button" onClick={() => void continueDiscovery()}>Continuar análisis</button>
                : <span className="suggestion-note">El Arquitecto de Proyecto te propone objetivos en el chat.</span>}
            </section>
            <section className="hero-section">
              <div>
                <div className="eyebrow">PROYECTO LOCAL · INSPECCIÓN REAL</div>
                <h1>{section === "ProductShape" ? pdacPageLabels[pdacPage] : selectedNavigation.section === "Resumen" ? "Tu producto, en contexto" : selectedNavigation.section}</h1>
                <p>{section === "ProductShape" && pdacPage !== "overview" ? `Vista de entidad PDAC · ${pdacPageLabels[pdacPage]}. La información se actualiza con los hallazgos del asistente.` : `${selectedNavigation.detail}. El chat usa OMP real con el cwd del proyecto seleccionado.`}</p>
              </div>
              {section === "ProductShape" || section === "Arquitectura"
                ? <button className="outline-button primary-review" onClick={() => void sendMessage(reviewPrompt(section))}>{section === "ProductShape" ? "Revisar y diagramar" : "Revisar arquitectura"}</button>
                : <button className="outline-button" onClick={() => setActiveTab("Resumen")}>Ver resumen</button>}
            </section>
            {section === "ProductShape" ? (
              <section className="pdac-workbench">
                <article className="panel-card pdac-state-card">
                  <div className="pdac-state-header">
                    <div>
                      <div className="card-kicker">PDAC · ESTADO ACTUAL</div>
                      <h2>{pdacState}</h2>
                      <p>{pdacStateDetail}</p>
                    </div>
                    <span className={`pdac-state-badge ${sending ? "working" : assistantFindings.length > 0 ? "draft" : "empty"}`}>{sending ? "TRABAJANDO" : assistantFindings.length > 0 ? "PROVISIONAL" : "PENDIENTE"}</span>
                  </div>
                  <div className="pdac-state-summary"><strong>{pdacSignals.filter((signal) => signal.state === "found").length}/{pdacSignals.length}</strong><span>áreas PDAC con evidencia visible</span><span className="pdac-summary-separator">·</span><span>{diagramRevisions.length > 0 ? `${diagramRevisions.length} revisión${diagramRevisions.length === 1 ? "" : "es"} de mapa` : "sin mapa publicado"}</span></div>
                  <div className="pdac-signal-list" aria-label="Áreas del estado PDAC">
                    {pdacSignals.map((signal) => <button className={`pdac-signal ${signal.state} ${pdacFocus === signal.id ? "selected" : ""}`} key={signal.id} onClick={() => openPdacPage(signal.id)} aria-pressed={pdacPage === signal.id}><span className="pdac-signal-dot" /><strong>{signal.label}</strong><small>{signal.state === "found" ? "ver página" : "pendiente"}</small></button>)}
                  </div>
                </article>
                {pdacPage !== "overview" && <article className="panel-card pdac-entity-banner"><div><div className="card-kicker">ENTIDAD PDAC</div><h2>{pdacPageLabels[pdacPage]}</h2><p>Esta página reúne sólo la evidencia disponible para esta entidad. El asistente seguirá completándola sin inventar datos.</p></div><button className="outline-button" onClick={() => openPdacPage("overview")}>← Volver al estado</button></article>}
                <article className="panel-card pdac-diagram-card">
                  <div className="card-heading"><div><div className="card-kicker">{latestDiagram ? (selectedDiagramRevision?.status === "provisional" ? "MAPA PDAC · PROVISIONAL" : "MAPA PDAC · EVIDENCIA") : "MAPA PDAC · ESPERANDO EVIDENCIA"}</div><h2>{latestDiagram ? "Relaciones encontradas" : "El mapa aparecerá aquí"}</h2></div><span className="live-badge"><span className={sending ? "active" : ""} />{sending ? "ACTUALIZANDO" : "LIVE"}</span></div>
                  {diagramRevisions.length > 1 && <div className="diagram-revisions" aria-label="Revisiones del mapa PDAC">{diagramRevisions.map((revision, index) => <button className={revision.id === selectedDiagramRevisionId ? "selected" : ""} key={revision.id} onClick={() => setSelectedDiagramRevisionId(revision.id)}>{revision.status === "provisional" ? "Provisional" : "Guardado"} {index + 1}</button>)}</div>}
                  {latestDiagram ? <div className="system-map generated-system-map"><DiagramVisual source={latestDiagram} canvas /></div> : <div className="system-map diagram-placeholder"><span className="placeholder-icon">{sending ? "◌" : "◇"}</span><strong>{sending ? "Construyendo relaciones…" : "Todavía no hay un diagrama publicado"}</strong><small>{sending ? "El mapa se actualizará cuando el asistente encuentre relaciones confirmables." : "Revisar y diagramar inicia el análisis con evidencia real."}</small></div>}
                  <button className="card-link" onClick={() => void sendMessage(reviewPrompt("ProductShape"))}>{sending ? "Actualizando mapa…" : "Actualizar mapa con OMP"} <span>→</span></button>
                </article>
                <article className="panel-card pdac-details-card">
                  <div className="card-heading"><div><div className="card-kicker">DETALLE DINÁMICO</div><h2>{pdacPage === "overview" ? "Lo que va encontrando" : pdacPageLabels[pdacPage]}</h2></div><button className="pdac-clear-focus" onClick={() => openPdacPage("overview")}>Ver estado</button></div>
                  <div className="pdac-detail-list" aria-live="polite">
                    {visibleFindings.length > 0 ? visibleFindings.slice(0, 8).map((finding, index) => <div className={`pdac-detail-row ${finding.live ? "live" : ""}`} key={finding.id}><span className="pdac-detail-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{finding.title}</strong>{finding.live && <span className="pdac-new-badge">NUEVO</span>}<small>{finding.detail}{finding.evidence ? ` · ${finding.evidence}` : ""}</small></div></div>) : <div className="assistant-empty"><strong>{sending ? "Esperando el siguiente hallazgo…" : "Esta área todavía no tiene evidencia."}</strong><small>El asistente la completará cuando encuentre información verificable en el proyecto.</small></div>}
                  </div>
                </article>
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
                <div className="card-heading"><div><div className="card-kicker">{latestDiagram ? (selectedDiagramRevision?.status === "provisional" ? "VISTA PROVISIONAL · PRODUCTSHAPE" : "EVIDENCIA GUARDADA") : "PRODUCTSHAPE · INSPECCIÓN REAL"}</div><h2>{latestDiagram ? "Mapa que está construyendo el asistente" : "Mapa pendiente de evidencia"}</h2></div><span className="live-badge"><span className={sending ? "active" : ""} />{sending ? "ACTUALIZANDO" : "LIVE"}</span></div>
                {diagramRevisions.length > 1 && <div className="diagram-revisions" aria-label="Revisiones temporales del diagrama">{diagramRevisions.map((revision, index) => <button className={revision.id === selectedDiagramRevisionId ? "selected" : ""} key={revision.id} onClick={() => setSelectedDiagramRevisionId(revision.id)}>{revision.status === "provisional" ? "Provisional" : "Guardado"} {index + 1}</button>)}</div>}
                {latestDiagram
                  ? <div className="system-map generated-system-map"><DiagramVisual source={latestDiagram} canvas /></div>
                  : <div className="system-map diagram-placeholder">
                    <span className="placeholder-icon">{sending ? "◌" : "◇"}</span>
                    <strong>{sending ? "El asistente está construyendo el mapa…" : "Todavía no hay un diagrama publicado"}</strong>
                    <small>{sending ? "Aparecerá en cuanto OMP entregue una relación coherente." : "Revisa y diagramar iniciará una inspección con evidencia real."}</small>
                  </div>}
                <button className="card-link" onClick={() => { setSection("Arquitectura"); setActiveTab("Arquitectura"); void sendMessage(reviewPrompt("Arquitectura")); }}>Pedir diagrama real <span>→</span></button>
              </article>
              <article className="panel-card activity-card">
                <div className="card-heading"><div><div className="card-kicker">ASISTENTE DE PRODUCTSHAPE</div><h2>Lo que va encontrando</h2></div><span className="live-badge"><span className={sending ? "active" : ""} />{sending ? "TRABAJANDO" : "SESIÓN"}</span></div>
                <div className="assistant-findings" aria-live="polite">
                  {sending && <div className="assistant-stage"><span className="activity-dot purple" /><div><strong>Revisando el proyecto</strong><small>{activity}. El siguiente hallazgo aparecerá aquí.</small></div></div>}
                  {assistantFindings.length > 0
                    ? assistantFindings.slice(0, 4).map((finding, index) => <div className="activity-row" key={finding.id}><span className={`activity-dot ${index % 2 === 0 ? "blue" : "purple"}`} /><div><strong>{finding.title}</strong><small>{finding.detail}{finding.evidence ? ` · ${finding.evidence}` : ""}</small></div><span className="activity-arrow">↗</span></div>)
                    : !sending && <div className="assistant-empty"><strong>El asistente todavía no ha publicado hallazgos.</strong><small>Inicia «Revisar y diagramar» para que lea ProductShape y lo contraste con el código.</small></div>}
                </div>
                <button className="card-link" onClick={() => setSection("Evidencia")}>Ver evidencia del análisis <span>→</span></button>
              </article>
            </section>
              </>
            )}
          </div>
        </main>

        <aside className="chat-panel" aria-label="Chat OMP">
          <div className="chat-header"><div><div className="chat-title"><span className="omp-orbit">✦</span> OMP <span className="chat-live">REAL</span></div><div className="chat-context">contexto: {section.toLowerCase()} · {displayChatStatus(chatStatus)}</div></div><button className="quiet-button" aria-label="Opciones del chat">•••</button></div>
          <div className="chat-activity" aria-live="polite"><span className={`activity-pulse ${sending ? "active" : ""}`} />{activity}</div>
          <div className="chat-messages" aria-live="polite">
            <div className="chat-date">HOY · SESIÓN ACTIVA</div>
            {messages.map((message, index) => <div className={`message-row ${message.author}`} key={`${message.author}-${index}`}><div className="message-avatar">{message.author === "omp" ? "✦" : "LC"}</div><div className={`message-bubble ${message.streaming ? "streaming" : ""}`}><div className="message-author">{message.author === "omp" ? "OMP" : "TÚ"}</div>{message.author === "omp" ? <AssistantContent text={message.text || (message.streaming ? "…" : "")} /> : message.text}</div></div>)}
          </div>
          <div className="chat-suggestions" aria-label="Objetivos sugeridos">
            <div className="chat-suggestions-label">Te sugiero empezar por</div>
            <div className="chat-suggestions-grid">
              <button onClick={() => chooseObjective("Analiza este proyecto como brownfield: empieza por docs/product y después contrasta con el código. Devuelve hechos, inferencias, incógnitas y un diagrama confirmado.", "brownfield-discovery")}>Entender el proyecto</button>
              <button onClick={() => chooseObjective("Documenta la arquitectura existente a partir de ProductShape, src/ y tests.", "architecture-documentation")}>Documentar arquitectura</button>
            </div>
          </div>
          {chatError && <div className="chat-error" role="alert">{chatError}</div>}
          <div className="chat-composer"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Pregunta sobre este proyecto…" aria-label="Mensaje para OMP" rows={3} /><div className="composer-footer"><span className="composer-hint">{sending ? "Tarea en curso…" : "↵ enviar · ⇧↵ nueva línea"}</span><button className="send-button" onClick={() => void sendMessage()} aria-label="Enviar mensaje">↑</button></div></div>
          <div className="chat-footer"><span className="safe-dot" /> Sesión local · {displayChatStatus(chatStatus)} <span className="footer-spacer" /><span>ProjectStudio</span></div>
        </aside>
      </div>
      <footer className="statusbar"><span><span className="status-dot" /> Proyecto listo</span><span>8 casos de uso</span><span>12 evidencias</span><span>rama main</span><span className="statusbar-spacer" /><span>Fase 04 · chat RPC</span></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
