# OpenClaw: personalidad, memoria, proactividad y límites

> Investigación basada únicamente en fuentes first-party actuales: repositorio oficial `openclaw/openclaw` (`main`) y documentación en `docs.openclaw.ai`. El repositorio de OpenClaw evoluciona con rapidez; las recomendaciones de este documento son para ProjectStudio y no implican copiar su arquitectura completa.

## Resumen ejecutivo

OpenClaw separa cuatro cosas que a menudo se mezclan en un prompt:

1. **Identidad y voz**: archivos editables del workspace (`SOUL.md`, `IDENTITY.md`, `USER.md`, `AGENTS.md`) inyectados en el contexto con roles distintos.
2. **Memoria**: Markdown inspeccionable, con una capa curada y otra episódica indexada; la promoción a largo plazo está gobernada por procedencia y reglas, no sólo por similitud semántica.
3. **Proactividad**: actualmente se modela como una automatización programada ordinaria, con sesión, prompt, scratch, política de idle y entrega explícitas; el antiguo monitor heartbeat se migra a jobs.
4. **Límites**: las confirmaciones y permisos se hacen cumplir en runtime (tool policy, sandbox y exec approvals); la personalidad no es un mecanismo de seguridad.

La adaptación mínima para el Arquitecto de Proyecto es mantener una identidad estable y breve, separar memoria de proyecto de instrucciones, y convertir la revisión proactiva existente en un job explícito y auditable. No se recomienda introducir un Gateway, canales, plugins de memoria, dreaming ni un sistema multiagente sólo por imitar OpenClaw.

## 1. Fuentes primarias y alcance

- Repositorio oficial: [`openclaw/openclaw`](https://github.com/openclaw/openclaw).
- README del repositorio: [README.md](https://github.com/openclaw/openclaw/blob/main/README.md) (describe el Gateway, estado local, workspace y límites de seguridad).
- Runtime y workspace: [docs/concepts/agent.md](https://docs.openclaw.ai/concepts/agent), [docs/concepts/agent-workspace.md](https://docs.openclaw.ai/concepts/agent-workspace), [docs/concepts/system-prompt.md](https://docs.openclaw.ai/concepts/system-prompt).
- Primer arranque: [docs/start/bootstrapping.md](https://docs.openclaw.ai/start/bootstrapping).
- Personalidad: [docs/concepts/soul.md](https://docs.openclaw.ai/concepts/soul), plantilla [IDENTITY.md](https://docs.openclaw.ai/reference/templates/IDENTITY).
- Memoria: [docs/concepts/memory.md](https://docs.openclaw.ai/concepts/memory), [docs/concepts/memory-architecture.md](https://docs.openclaw.ai/concepts/memory-architecture), [docs/concepts/dreaming.md](https://docs.openclaw.ai/concepts/dreaming).
- Proactividad actual: [docs/gateway/heartbeat.md](https://docs.openclaw.ai/gateway/heartbeat) (documenta la migración a automation jobs).
- Límites y confirmaciones: [docs/tools/exec-approvals.md](https://docs.openclaw.ai/tools/exec-approvals), [docs/gateway/security/tool-permissions.md](https://docs.openclaw.ai/gateway/security/tool-permissions), [docs/gateway/sandboxing.md](https://docs.openclaw.ai/gateway/sandboxing).

Referencias directas de código first-party usadas:

- [`src/agents/workspace-bootstrap-policy.ts`](https://github.com/openclaw/openclaw/blob/main/src/agents/workspace-bootstrap-policy.ts): nombres canónicos, orden y política de lectura/escritura del bootstrap.
- [`src/agents/workspace.ts`](https://github.com/openclaw/openclaw/blob/main/src/agents/workspace.ts): límites, plantillas, evidencia de workspace configurado y atestación.
- [`src/agents/bootstrap-files.ts`](https://github.com/openclaw/openclaw/blob/main/src/agents/bootstrap-files.ts): resolución por sesión, procedencia y filtrado de memoria/ejecution workspace.
- [`src/agents/system-prompt.ts`](https://github.com/openclaw/openclaw/blob/main/src/agents/system-prompt.ts): ensamblaje del system prompt y secciones de ejecución.
- [`src/cron/default-proactive-job.ts`](https://github.com/openclaw/openclaw/blob/main/src/cron/default-proactive-job.ts): job proactivo por defecto.
- [`src/cron/`](https://github.com/openclaw/openclaw/tree/main/src/cron): scheduler, sesiones aisladas, scratch, admisión, entrega y migración de heartbeats.
- [`src/agents/agent-tools.before-tool-call*`](https://github.com/openclaw/openclaw/tree/main/src/agents): aplicación runtime de políticas de herramientas y aprobaciones.

## 2. Hechos observados: identidad y persona

### 2.1 Capas separadas

Según `docs/concepts/agent.md` y `src/agents/workspace-bootstrap-policy.ts`, cada agente tiene un workspace propio y el conjunto canónico de archivos es:

| Archivo | Función observada |
|---|---|
| `AGENTS.md` | instrucciones operativas y guía de trabajo/memoria |
| `SOUL.md` | persona, tono, postura y límites conversacionales |
| `IDENTITY.md` | nombre, criatura/tipo, vibe, emoji y avatar |
| `USER.md` | perfil y preferencias del usuario |
| `BOOTSTRAP.md` | ritual de primer arranque, temporal |
| `MEMORY.md` | memoria duradera raíz, sólo si existe |

El runtime carga estos archivos en el **system prompt / Project Context** al comienzo de una sesión (con gates especiales para `BOOTSTRAP.md` y `MEMORY.md`). Un archivo ausente normalmente produce un marcador corto; los archivos grandes se recortan con aviso. Los archivos del workspace de ejecución pueden aportar `AGENTS.md`, pero OpenClaw no toma de allí `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md` ni `BOOTSTRAP.md` como identidad del agente ([`bootstrap-files.ts`](https://github.com/openclaw/openclaw/blob/main/src/agents/bootstrap-files.ts)).

La documentación de `SOUL.md` recomienda que allí sólo vivan voz, tono, opiniones, brevedad y límites conversacionales; las reglas operativas deben quedarse en `AGENTS.md`. Esto evita usar un solo prompt monolítico como personalidad, memoria y política de seguridad a la vez.

`IDENTITY.md` es una fuente editable pero también tiene sincronización con la identidad de configuración/UI mediante `openclaw agents set-identity`. El template actual admite `Name`, `Creature`, `Vibe`, `Emoji` y `Avatar`; `Theme` puede prevalecer al sincronizar ([template oficial](https://docs.openclaw.ai/reference/templates/IDENTITY)).

### 2.2 Ritual de primera ejecución

`docs/start/bootstrapping.md` y el template [`BOOTSTRAP.md`](https://github.com/openclaw/openclaw/blob/main/docs/reference/templates/BOOTSTRAP.md) describen un flujo de una sola vez:

- se crean `AGENTS.md`, `SOUL.md`, `IDENTITY.md`, `USER.md` y `BOOTSTRAP.md`;
- el agente pregunta cómo llamarlo y propone una línea de vibe;
- puede generar cuatro avatares si `image_generate` está disponible;
- se persiste la identidad tanto en archivos como en la configuración del agente;
- `BOOTSTRAP.md` se elimina una vez configurado el workspace.

El runtime determina que el workspace ya está configurado cuando los archivos de perfil se han apartado de la plantilla o existe memoria/skills; además conserva estado/atestación en SQLite para no reseedear silenciosamente un workspace borrado. Esto es una garantía de onboarding, no una personalidad dinámica por turno.

## 3. Hechos observados: memoria y contexto

### 3.1 Memoria explícita, editable y por capas

La documentación de memoria afirma que no hay estado oculto: el modelo sólo recuerda lo que se guarda en el workspace. La estructura por defecto es:

- `USER.md`: preferencias, estilo, relaciones y contexto activo; es el modelo compacto del usuario.
- `MEMORY.md`: hechos y decisiones duraderos no pertenecientes al perfil.
- `memory/YYYY-MM-DD.md` (y variantes slug): notas episódicas y contexto de trabajo.
- `DREAMS.md`: resúmenes de consolidación para revisión humana.

La arquitectura de memoria define tiers con comportamiento diferente ([`memory-architecture.md`](https://docs.openclaw.ai/concepts/memory-architecture)):

| Tier | Superficie | Inyección/uso |
|---|---|---|
| Instrucciones | `AGENTS.md` | siempre al inicio |
| Curado | `MEMORY.md`, `USER.md` | al inicio si la procedencia es elegible, dentro de presupuesto |
| Episódico | notas diarias y transcripts | búsqueda/recall bajo demanda; no bootstrap ordinario |
| Prospectivo | intents en SQLite y cron jobs | sólo al dispararse una condición |
| Revisión | `DREAMS.md` | no se inyecta automáticamente |

`memory_search` hace recuperación híbrida (semántica + keywords cuando hay proveedor), `memory_get` lee un archivo/rango, y los plugins pueden suministrar almacenamiento alternativo. La documentación advierte que la recuperación parcial o stale debe declararse; no se debe presentar como certeza.

### 3.2 Procedencia y promoción

Cada entrada indexada conserva procedencia fuera del texto: `owner`, `agent`, `untrusted` o `system`, además de tipo de sesión, timestamp y clave de supersesión. Cron, heartbeat y subagentes no producen candidatos elegibles para memoria duradera. El contenido recordado no se reextrae como memoria nueva (prevención de loops).

El flujo de escritura normal es episódico → dreaming/consolidación → `MEMORY.md`/`USER.md`. La promoción está bloqueada estructuralmente para contenido `untrusted` o `system`, y la salida de consolidación pasa validaciones de tamaño, pérdida acotada y concurrencia optimista. La memoria puede conservar el contexto de una aprobación, una restricción temporal o una autoridad, pero la propia documentación aclara que **memoria no aplica políticas**: para eso están approvals, sandboxing y scheduled tasks.

Hay además un flush silencioso antes de compaction para guardar contexto importante en memoria episódica; está habilitado por defecto y puede desactivarse con `agents.defaults.compaction.memoryFlush.enabled` ([memory overview](https://docs.openclaw.ai/concepts/memory#automatic-memory-flush)).

### 3.3 Presupuesto de contexto

La documentación de system prompt fija por defecto:

- `agents.defaults.bootstrapMaxChars`: 20.000 caracteres por archivo.
- `agents.defaults.bootstrapTotalMaxChars`: 60.000 caracteres en total.

La copia inyectada puede truncarse pero el archivo de disco se conserva. `/context list`, `/context detail` y `/context map` permiten inspeccionar tamaños y contribuyentes sin volcar necesariamente todo el prompt. Las notas diarias no cuentan en el bootstrap normal; se buscan bajo demanda (con excepciones de `/new` y `/reset`).

## 4. Hechos observados: heartbeat y proactividad

La documentación actual titulada **Heartbeat migration** deja claro que los monitores heartbeat heredados ya no son la abstracción canónica: `openclaw doctor --fix` los convierte en **automation jobs** editables, con identidad, historial, schedule, política, scratch y delivery. El runtime ya no depende de un monitor global periódico.

El setup explícito puede crear un job **Proactive check** para el agente propietario:

- cadencia por defecto de 30 minutos, salvo política del proveedor;
- sesión principal del agente;
- `idleOnly: true`, para no interrumpir trabajo de foreground;
- prompt por defecto: revisar scratch y contexto relevante, actuar sólo si hace falta y responder `NO_REPLY` si no hay nada que comunicar;
- `skipIfScratchEmpty: true` cuando el scratch está explícitamente vacío;
- entrega al DM del owner;
- job persistido: arranque/reload no lo recrea y borrarlo es una decisión duradera.

Esto está implementado de forma concreta en [`src/cron/default-proactive-job.ts`](https://github.com/openclaw/openclaw/blob/main/src/cron/default-proactive-job.ts), en particular `DEFAULT_PROACTIVE_PROMPT` y `createDefaultProactiveJob`. El scratch es contexto privado del job, con escrituras protegidas por revisión, pero no es un scheduler ni debe contener secretos. Jobs aislados pueden iniciar contexto nuevo; jobs compartidos usan una sesión nombrada. Los follow-ups de procesos, tareas o reinicios usan ejecución de sesión ordinaria y no requieren un heartbeat habilitado.

Los resultados silenciosos se expresan con `NO_REPLY` o mediante `record_result` con `no_change`; los errores siguen siendo fallos. La entrega puede tener políticas de horario activo, idle, target y direct-message. Es importante distinguir esto de una llamada automática desde cada render de UI: en OpenClaw la cadencia, admisión y entrega viven en un job persistido.

## 5. Hechos observados: límites, permisos y confirmaciones

OpenClaw declara que el riesgo se hace cumplir en runtime y no en prosa de personalidad. La cadena relevante es:

1. **Tool policy** decide si una herramienta existe para ese agente/sesión.
2. **Sandbox** restringe workspace y host de ejecución.
3. **Exec approvals** decide si un comando host requiere aprobación, coincide con allowlist o se deniega.
4. **Políticas de owner/canal** protegen operaciones de control, mensajes y acceso entre sesiones.

Las exec approvals requieren que política + allowlist + aprobación opcional coincidan. La configuración normalizada de exec incluye `deny`, `allowlist`, `ask` y `full`; `askFallback` por defecto es `deny` si no hay UI de aprobación. La aprobación enlaza contexto exacto (cwd/argv/env y, cuando corresponde, identidad del ejecutable/archivo) y se vuelve a validar antes de ejecutar. La documentación advierte que approvals reducen ejecuciones accidentales, pero **no son por sí solas una frontera de autenticación ni una política read-only**.

`gateway` y `cron` son herramientas sensibles de control: gateway lee topología/configuración y ejecuta acciones de mantenimiento; cron crea jobs que sobreviven al chat. La guía recomienda denegar `gateway`, `cron`, `sessions_spawn` y `sessions_send` para superficies que procesan contenido no confiable. Plugins corren dentro del Gateway y se consideran código confiable: instalación/actualización debe estar explícitamente permitida y revisada.

Para el agente de ProjectStudio, el principio relevante es: la instrucción «propón/modifica» no equivale a autorización para escribir el repositorio original, hacer push, acceder a cloud o ejecutar shell peligroso. La autorización debe estar asociada a un scope exacto y comprobada en el host, no sólo en la respuesta del LLM.

## 6. Diferencias observadas con ProjectStudio

Estas diferencias se basan en código y documentación presentes en este repositorio, no en suposiciones:

| Tema | OpenClaw | ProjectStudio actual |
|---|---|---|
| Identidad | `SOUL.md` + `IDENTITY.md` + `USER.md` + `AGENTS.md`, con bootstrap de una vez y sincronización de identidad | Personalidad inline en [`packages/orchestrator/src/agent-runtime.ts`](../../packages/orchestrator/src/agent-runtime.ts), función `promptForAgent`; saludo visible en [`apps/desktop/src/renderer/main.tsx`](../../apps/desktop/src/renderer/main.tsx) |
| Contexto de proyecto | Workspace del agente, separado del execution workspace; archivos de identidad/memoria no se toman automáticamente del proyecto ejecutado | El worker pasa el proyecto como `cwd` a OMP y usa la configuración `--no-extensions --no-skills --no-rules --no-ui`; el contexto de producto se orienta mediante prompts y señales locales |
| Memoria | Markdown curado/episódico, índice SQLite, provenance, search/get y consolidación background | Checkpoints de LangGraph en `.tmp/agent-runtime.sqlite` y sesiones OMP en `.tmp/omp-sessions`; ProductShape/revisiones se conservan en memoria durante la sesión según ADR-025, sin memoria semántica durable del usuario/proyecto equivalente |
| Proactividad | Job persistido con schedule, scratch, idle admission, sesión y delivery; heartbeat legacy migrado | Timer del renderer en `apps/desktop/src/renderer/main.tsx` (`setInterval` de 60s): tras 15 min de inactividad y con hallazgos, máximo una revisión por intervalo; sólo brownfield y no mientras se envía |
| Confirmación | Gates runtime de herramientas, sandbox, approvals y políticas de owner/canal | Gating explícito de LangGraph para inspección en [`packages/orchestrator/src/studio-graph.ts`](../../packages/orchestrator/src/studio-graph.ts), con `interrupt`, `approved`/`rejected`; ADR/PRD exigen scopes para cambios, worktrees y publicación |
| Exposición | OpenClaw oculta contexto interno y aplica límites de prompt; su runtime controla la entrega por canal | ProjectStudio ya oculta prompts, frames RPC y razonamiento en la UI; publica progreso resumido, hallazgos y artefactos normalizados |

Conclusión de la comparación: ProjectStudio ya tiene buenas decisiones de producto (Arquitecto de Proyecto, hechos/inferencias/incógnitas, evidencia, gates, separación de canal de control/presentación), pero la identidad y la proactividad están acopladas a prompts/rendering. OpenClaw aporta patrones útiles de **persistencia y procedencia**, no una razón para adoptar su Gateway o todos sus canales.

## 7. Diseño mínimo recomendado para el Arquitecto de Proyecto

### 7.1 Contrato de identidad

Introducir una configuración por proyecto/agente con cuatro bloques, aunque inicialmente se serialice en un único artefacto local:

```text
identity:  { name: "Arquitecto de Proyecto", role, vibe, locale }
voice:     { tone, brevity, responseShape, prohibitedDisclosure }
operator:  { userLabel, preferences }              # opcional
instructions: { evidenceRules, workflowRules }     # separadas de voice
```

Recomendación práctica:

- Mantener `SOUL`/voz corta y estable: pragmático, claro, honesto con incertidumbre, no invasivo.
- Mantener reglas de operación fuera de la voz: no inventar, citar rutas, separar observado/inferido/unknown, no publicar sin gate, no exponer RPC/razonamiento.
- Renderizar identidad/instrucciones una vez por sesión y refrescar sólo cuando cambien; no concatenar un prompt de personalidad diferente en cada botón sin un identificador/versionado.
- Conservar la identidad entre modos brownfield/greenfield/architecture; sólo cambia el objetivo y el scope.

No adoptar el ritual de avatar, criatura o generación de imagen salvo que ProductStudio lo pida como feature de UX; no aporta al núcleo de documentación arquitectónica.

### 7.2 Memoria de dos capas, no “memoria mágica”

Implementar primero dos superficies locales y trazables:

1. `project-memory.md` o registro equivalente por `projectId`: decisiones confirmadas, preferencias de salida, restricciones y resumen durable muy breve.
2. `project-notes/` o eventos SQLite: hallazgos, sesiones, contradicciones, evidencias y decisiones temporales.

Cada entrada debería guardar como mínimo `projectId`, `threadId`, `runId`, `source`, `observedAt`, `status` (`observed|inferred|user-confirmed|unknown`) y, si cambia una decisión, `supersedes`. Inyectar al inicio sólo el resumen confirmado y recuperar notas bajo demanda. No inyectar toda la transcripción ni todo el repositorio.

Promoción mínima recomendada: sólo hechos/decisiones provenientes de usuario o evidencia local confiable y confirmada; nunca promover automáticamente texto de una revisión proactiva, una salida marcada `unknown`, un resultado remoto no verificado o instrucciones de herramientas. Si no hay evidencia o la memoria está desactualizada, decirlo explícitamente. Esto toma la idea de provenance de OpenClaw sin introducir dreaming/model calls adicionales.

### 7.3 Proactividad como job de dominio

Reemplazar gradualmente el `setInterval` del renderer por un registro de job en el proceso principal/runtime:

```text
ProactiveReviewJob {
  id, projectId, scopeId, enabled,
  cadence, activeHours?, idleOnly: true,
  lastInteractionAt, lastRunAt, nextRunAt,
  scratch: { checklist, revision },
  preconditions: { brownfieldOnly, minFindings: 1, noActiveRun: true },
  delivery: "in-app activity" | "chat suggestion"
}
```

Comportamiento mínimo:

- mantener la regla de 15 minutos ya aceptada por ADR-026;
- ejecutar sólo con hallazgos previos, sin job concurrente y fuera de greenfield/entrevista;
- revisar contradicciones/cambios/huecos y devolver como máximo tres observaciones + una pregunta;
- si no hay cambio accionable, registrar `no_change` y no interrumpir el chat;
- persistir `lastRunAt`, resultado, scope y revisión de hallazgos para evitar duplicados después de reinicio;
- mostrar al usuario que se trata de una revisión sugerida, no de una nueva decisión aceptada.

No crear una infraestructura genérica de cron en esta fase: basta un scheduler interno del proceso principal con admisión y event log. Si más adelante se necesitan recordatorios exactos o varios proyectos, extraer el job a un servicio de automatización.

### 7.4 Límite y confirmación mínimos

Mantener el gate de LangGraph, pero hacer que sea un broker de permisos explícito y reusable:

- cada operación mutante tenga `actionId`, `projectId`, `scopeId`, `expectedRevision/treeSha` y lista exacta de rutas/recursos;
- lectura de repositorio y generación de propuesta pueden ser automáticas dentro del scope aprobado;
- escritura, comandos con efectos externos, credenciales, cloud, commit/push/PR y publicación requieren gates separados y visibles;
- una aprobación no se hereda automáticamente de otro proyecto, revisión, rama o tipo de operación;
- ante estado incierto, reconsultar filesystem/Git/event store antes de reintentar; no asumir que `abort` revierte un cambio;
- la UI debe mostrar `waiting-approval`, qué se aprobaría y qué no, y registrar decisión/rechazo en el audit log.

Esto conserva las decisiones existentes de PRD/ADRs y aplica el principio OpenClaw de que la seguridad debe vivir en código/runtime, no sólo en el prompt.

## 8. Qué no copiar

- No copiar el Gateway, sus canales, pairing, nodos ni `gateway` tool: ProjectStudio es una aplicación local con OMP como adaptador.
- No copiar todos los plugins de memoria, embeddings, PostgreSQL, dreaming y recall cross-conversation antes de demostrar una necesidad de producto.
- No tratar `HEARTBEAT.md` como un lenguaje de tareas: OpenClaw lo retiró como monitor canónico; para ProjectStudio un job tipado es más simple.
- No usar memoria para aplicar permisos; la memoria sólo aporta contexto y debe poder ser stale.
- No hacer que `SOUL` contenga reglas de seguridad, ni que un saludo visible sea la única fuente de identidad.
- No ejecutar revisiones proactivas durante greenfield ni durante una tarea activa; esa diferencia de ProjectStudio es intencional y es más adecuada para una entrevista.

## 9. Criterios de aceptación sugeridos para una futura implementación

1. Una sesión nueva muestra identidad y contrato de voz/versiones sin duplicar prompt por workflow.
2. Cambiar de proyecto no mezcla memoria, evidencias o scopes.
3. El contexto inicial incluye sólo resumen durable dentro de un presupuesto medible; las notas grandes se recuperan bajo demanda.
4. Una revisión proactiva deja un evento auditable, no interrumpe una ejecución activa y no se duplica tras reiniciar.
5. Un hallazgo de revisión no se promociona automáticamente a `USER`/memoria durable ni a ProductShape canónico.
6. Toda mutación muestra scope exacto y queda `waiting-approval` hasta una decisión explícita; rechazo y expiración no ejecutan nada.
7. El usuario puede distinguir `observed`, `inferred`, `unknown` y `user-confirmed`, con rutas/evidencia cuando existan.

