import React, { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { visibleTextDelta } from "./chat-events.js";

type Section = "Resumen" | "ProductShape" | "Arquitectura" | "Evidencia" | "Cambios";
type Message = { author: "user" | "omp"; text: string; streaming?: boolean };

const navigation: Array<{ section: Section; icon: string; detail: string }> = [
  { section: "Resumen", icon: "⌂", detail: "Vista del proyecto" },
  { section: "ProductShape", icon: "◇", detail: "Producto y casos de uso" },
  { section: "Arquitectura", icon: "◎", detail: "C4 y escenarios" },
  { section: "Evidencia", icon: "▣", detail: "Hechos verificables" },
  { section: "Cambios", icon: "⇄", detail: "Diffs y aprobaciones" },
];

const initialMessages: Message[] = [
  { author: "omp", text: "Hola. Soy el espacio de trabajo local de ProjectStudio." },
  { author: "omp", text: "En esta fase puedes explorar el proyecto demo y navegar por sus vistas." },
];


function App(): JSX.Element {
  const [section, setSection] = useState<Section>("Resumen");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [project, setProject] = useState("DrumCoach · demo local");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [activeTab, setActiveTab] = useState("Resumen");
  const [chatMode, setChatMode] = useState("real");
  const [chatStatus, setChatStatus] = useState("starting");
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubscribe = window.studio.chat.onEvent((event) => {
      if (event.type === "status") {
        setChatStatus(event.status);
      } else if (event.type === "ready") {
        setChatStatus("ready");
      } else if (event.type === "message_update") {
        const delta = visibleTextDelta(event.frame);
        if (!delta) return;
        setMessages((current) => {
          const last = current[current.length - 1];
          if (last?.author === "omp" && last.streaming) {
            return [...current.slice(0, -1), { ...last, text: last.text + delta }];
          }
          return [...current, { author: "omp", text: delta, streaming: true }];
        });
      } else if (event.type === "message_end") {
        const text = stringField(event.frame, "text");
        setMessages((current) => {
          const last = current[current.length - 1];
          if (last?.author === "omp" && last.streaming) {
            return [...current.slice(0, -1), { ...last, text: text ?? last.text, streaming: false }];
          }
          return text ? [...current, { author: "omp", text }] : current;
        });
      } else if (event.type === "session_settled") {
        setChatStatus("settled");
        setSending(false);
      } else if (event.type === "warning" || event.type === "error") {
        setChatError(event.message);
        setChatStatus("failed");
        setSending(false);
      }
    });

    void window.studio.chat.start().then((result) => {
      setChatMode(result.mode);
      setChatStatus(result.status);
      if (result.error) setChatError(result.error);
    }).catch((error: unknown) => {
      setChatStatus("failed");
      setChatError(error instanceof Error ? error.message : String(error));
    });
    return unsubscribe;
  }, []);

  const selectedNavigation = useMemo(
    () => navigation.find((item) => item.section === section) ?? navigation[0],
    [section],
  );

  async function sendMessage(): Promise<void> {
    const text = chatInput.trim();
    if (!text) return;
    setMessages((current) => [...current, { author: "user", text }]);
    setChatInput("");
    setChatError("");
    setSending(true);
    try {
      await window.studio.chat.send(text);
    } catch (error) {
      setSending(false);
      setChatError(error instanceof Error ? error.message : String(error));
      setChatStatus("failed");
    }
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
          <select value={project} onChange={(event) => setProject(event.target.value)} aria-label="Proyecto activo">
            <option>DrumCoach · demo local</option>
            <option>notes · brownfield pendiente</option>
          </select>
        </label>
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
            <div className="tree-branch"><span>◈</span> repo local</div>
            <div className="tree-branch"><span>◌</span> worktree demo</div>
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
              <div><strong>{chatMode === "real" ? "OMP real" : "OMP emulado"}</strong><small>RPC v2 · {chatStatus}</small></div>
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
            <div className="breadcrumb"><span>DrumCoach</span><span>/</span><strong>{selectedNavigation.section}</strong><span className="breadcrumb-spacer" /><span className="revision-label">revisión demo · r1</span></div>
            <section className="hero-section">
              <div>
                <div className="eyebrow">PROYECTO DEMO · VISTA VIVA</div>
                <h1>{selectedNavigation.section === "Resumen" ? "Tu producto, en contexto" : selectedNavigation.section}</h1>
                <p>{selectedNavigation.detail}. Esta superficie es un shell funcional; los motores semánticos se conectarán en fases posteriores.</p>
              </div>
              <button className="outline-button" onClick={() => setActiveTab("Resumen")}>Ver resumen</button>
            </section>
            <section className="metric-grid" aria-label="Resumen del proyecto">
              <article className="metric-card accent-card"><div className="metric-label">CASOS DE USO</div><div className="metric-value">08</div><div className="metric-note positive">↑ 2 esta semana</div></article>
              <article className="metric-card"><div className="metric-label">COMPONENTES C4</div><div className="metric-value">14</div><div className="metric-note">3 con evidencia nueva</div></article>
              <article className="metric-card"><div className="metric-label">EVIDENCIAS</div><div className="metric-value">12</div><div className="metric-note">último hallazgo hace 4 min</div></article>
              <article className="metric-card"><div className="metric-label">CAMBIOS PENDIENTES</div><div className="metric-value">02</div><div className="metric-note warning">requieren revisión</div></article>
            </section>
            <section className="dashboard-grid">
              <article className="panel-card architecture-card">
                <div className="card-heading"><div><div className="card-kicker">ARQUITECTURA · PROVISIONAL</div><h2>Mapa del sistema</h2></div><button className="more-button" aria-label="Más opciones">•••</button></div>
                <div className="system-map">
                  <div className="map-node user-node"><span>◉</span><strong>Persona</strong><small>músico</small></div>
                  <div className="map-line line-one" />
                  <div className="map-node app-node"><span>✦</span><strong>DrumCoach</strong><small>aplicación local</small></div>
                  <div className="map-line line-two" />
                  <div className="map-node service-node"><span>⌘</span><strong>Transcripción</strong><small>pipeline Python</small></div>
                  <div className="map-badge">3 relaciones · r1</div>
                </div>
                <button className="card-link" onClick={() => { setSection("Arquitectura"); setActiveTab("Arquitectura"); }}>Abrir arquitectura <span>→</span></button>
              </article>
              <article className="panel-card activity-card">
                <div className="card-heading"><div><div className="card-kicker">ACTIVIDAD</div><h2>Últimos hallazgos</h2></div><span className="live-badge"><span /> LIVE</span></div>
                <div className="activity-list">
                  <div className="activity-row"><span className="activity-dot blue" /><div><strong>Pipeline de audio identificado</strong><small>evidencia · hace 4 min</small></div><span className="activity-arrow">↗</span></div>
                  <div className="activity-row"><span className="activity-dot purple" /><div><strong>Vista C4 provisional creada</strong><small>arquitectura · hace 8 min</small></div><span className="activity-arrow">↗</span></div>
                  <div className="activity-row"><span className="activity-dot green" /><div><strong>Tests importados del repo</strong><small>verificación · hace 12 min</small></div><span className="activity-arrow">↗</span></div>
                </div>
                <button className="card-link" onClick={() => setSection("Evidencia")}>Ver timeline <span>→</span></button>
              </article>
            </section>
            <section className="welcome-strip"><div className="welcome-icon">✦</div><div><strong>Empieza por preguntar algo sobre el proyecto</strong><span>El chat conserva el contexto de la vista seleccionada.</span></div><button className="suggestion" onClick={() => setChatInput("¿Qué componentes tiene este proyecto?")}>¿Qué componentes hay? <span>↗</span></button></section>
          </div>
        </main>

        <aside className="chat-panel" aria-label="Chat OMP">
          <div className="chat-header"><div><div className="chat-title"><span className="omp-orbit">✦</span> OMP <span className="chat-live">REAL</span></div><div className="chat-context">contexto: {section.toLowerCase()} · {chatStatus}</div></div><button className="quiet-button" aria-label="Opciones del chat">•••</button></div>
          <div className="chat-messages" aria-live="polite">
            <div className="chat-date">HOY · SESIÓN RPC</div>
            {messages.map((message, index) => <div className={`message-row ${message.author}`} key={`${message.author}-${index}`}><div className="message-avatar">{message.author === "omp" ? "✦" : "LC"}</div><div className={`message-bubble ${message.streaming ? "streaming" : ""}`}><div className="message-author">{message.author === "omp" ? "OMP" : "TÚ"}</div>{message.text || (message.streaming ? "…" : "")}</div></div>)}
          </div>
          {chatError && <div className="chat-error" role="alert">{chatError}</div>}
          <div className="chat-composer"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Pregunta sobre este proyecto…" aria-label="Mensaje para OMP" rows={3} /><div className="composer-footer"><span className="composer-hint">{sending ? "OMP está respondiendo…" : "↵ enviar · ⇧↵ nueva línea"}</span><button className="send-button" onClick={() => void sendMessage()} aria-label="Enviar mensaje">↑</button></div></div>
          <div className="chat-footer"><span className="safe-dot" /> RPC local · {chatStatus} <span className="footer-spacer" /><span>v0.2 chat</span></div>
        </aside>
      </div>
      <footer className="statusbar"><span><span className="status-dot" /> Proyecto listo</span><span>8 casos de uso</span><span>12 evidencias</span><span>rama main</span><span className="statusbar-spacer" /><span>Fase 04 · chat RPC</span></footer>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
