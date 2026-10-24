# ProjectStudio — estado de implementación

## Estado actual

```yaml
phase: '05'
state: WAITING_USER_APPROVAL
baselineCommit: 18d4333
branch: main
gate: F05-BROWNFIELD-WORKBENCH
userDecision: APPROVED
nextPhase: '05'
latestVerifiedCommit: 35735b0
manualVerification: required
```
El flujo brownfield combina workbench, registro local de proyectos, workflows LangGraph y OMP real. Esta iteración queda lista para revisión manual; no se hizo push.
El usuario autorizó continuar sin pausas entre gates. Fase 04 y los slices F05-T01..T10 quedan implementados; la revisión manual cubre la gestión de proyectos y la reanudación brownfield.

## Fase 04 — chat OMP visible

| ID | Estado | Superficie | Output verificable |
|---|---|---|---|
| F04-T01 | done | puente Electron | `apps/desktop/src/main.ts`, `apps/desktop/preload.cjs` |
| F04-T02 | done | chat React | `apps/desktop/src/renderer/main.tsx` |
| F04-T03 | done | tipos/estilos | `renderer.d.ts`, `styles.css` |
| F04-T04 | done | integración | renderer → IPC → OmpAdapter → RPC → renderer |
| F04-T05 | done | evidencia | `F04-T01-desktop-chat-*.png`, `F04-T03-desktop-chat-real.png` |
| F04-T06 | done | selección de repo | `PROJECTSTUDIO_PROJECT_ROOT` controla el cwd real de OMP |
| F04-T07 | done | diagrama en chat | bloque Mermaid de OMP se renderiza como mapa visual sin inventar nodos |

## Flujo funcionando

```text
renderer command
  → contextBridge
  → ipcMain
  → AgentWorkerRuntime
  → LangGraph StudioAgentRuntime
  → OmpAdapter real dentro del worker Node
  → OMP instalado y autenticado
  → eventos resumidos y respuesta final
  → chat/canvas visibles
```

El producto requiere que el usuario tenga OMP instalado, autenticado y con modelo configurado. No se crea un perfil aislado sin credenciales ni se ejecuta un sustituto simulado.

## Verificación automatizada

| Comando | Resultado | Evidencia |
|---|---|---|
| `pnpm build:all` | pass | renderer, main Electron y worker compilados |
| `pnpm typecheck && pnpm typecheck:desktop` | pass | contratos TypeScript |
| `pnpm lint` | pass | ESLint sin errores |
| `pnpm vitest run tests/agent-runtime.test.ts tests/contracts.test.ts tests/diagrams.test.ts` | pass | 7 tests |
| `pnpm test` | pass | 8 archivos, 16 tests; RPC/adapter real y contratos |
| `pnpm test:f04` | pass | Electron real, respuesta final visible y sin prompt interno |
| `pnpm test:e2e:projects` | pass | archivado reversible; ruta del repositorio sigue existiendo |
| `pnpm test:e2e:notes:diagram` | pass | Notes, diagrama almacenado, `tokensUsed: false` |
| `pnpm spike:omp-adapter --real` | pass | OMP real: ready, streaming y settled |
| `pnpm spike:omp --real` | pass | RPC real y negociación v2 |

## Evidencia visual

- `docs/implementation/evidence/F04-T01-desktop-chat-dark.png`
- `docs/implementation/evidence/F04-T01-desktop-chat-light.png`
- `docs/implementation/evidence/F04-T03-desktop-chat-real.png`

`F04-T03` muestra OMP real, una respuesta final del workflow y estado settled; el prompt interno no aparece en el chat.

## Cómo ejecutarlo

OMP es requisito del usuario:

```bash
omp --version
omp login
```

Después deja un modelo seleccionado/configurado en OMP y ejecuta:

```bash
pnpm desktop
```

El modo normal inicia `omp --mode rpc` usando la configuración global del usuario, el cwd del proyecto y el session directory de ProjectStudio.

Para inspeccionar otro repositorio local:

```bash
PROJECTSTUDIO_PROJECT_ROOT=/ruta/absoluta/al/proyecto pnpm desktop
```

El selector muestra el nombre real del repositorio configurado. En esta máquina no existe actualmente una ruta local `drumcoach`; por eso el diagrama de DrumCoach todavía está bloqueado por entrada, no por OMP.

Se puede seleccionar otro binario real con:

```bash
OMP_BIN=/ruta/a/omp pnpm desktop
```

## Hallazgos corregidos

1. El arranque anterior usaba `--profile projectstudio-phase04`, un perfil nuevo sin modelo. Se eliminó; ahora se reutiliza la configuración OMP del usuario.
2. La host tool real requería descripción no vacía y `parameters` como JSON Schema object. El adapter y el proceso Electron ya los envían.
3. El probe real final pasó: `ready`, negociación v2, streaming, `message_end`, `prompt_result` y `session_settled`.

## Fase 05 — proyecto brownfield Notes

| ID | Estado | Output verificable |
|---|---|---|
| F05-T01 | done | `PROJECTSTUDIO_PROJECT_ROOT` apunta a `/Users/luis/projects/notes` |
| F05-T02 | done | OMP real extrae ProductShape desde `docs/product/` |
| F05-T03 | done | OMP real contrasta arquitectura en `src/` y `tests/` |
| F05-T04 | done | Mermaid ProductShape y arquitectura renderizados en el chat |
| F05-T05 | done | respuestas, capturas y `notes-brownfield.md` persistidos |
| F05-T06 | done | CTA superior autoenvía; Mermaid guardado se publica en canvas sin nueva llamada OMP |
| F05-T07 | done | LangGraph `StudioAgentRuntime` recibe comandos; el worker Node es el único propietario del OMP real |
| F05-T08 | done | actividad resumida visible; prompts, deltas y frames internos ocultos |
| F05-T09 | done | listado visible, alta por carpeta, cambio de cwd y archivado soft-delete |
| F05-T10 | done | `.tmp/projectstudio-projects.json`, detección al retomar y ADR-024 |
### Verificación F05

```bash
pnpm spike:notes:productshape
```

Resultado observado: pass. El CLI de OMP real trabajó con `projectRoot=/Users/luis/projects/notes`, estado `settled`, protocolo 2, respuesta de 15.075 caracteres y Mermaid extraído de 1.207 caracteres.

`pnpm test:f04` pasó con Electron real: el worker LangGraph invocó OMP, la respuesta final llegó al chat y no se filtró el prompt interno.

Verificación visual del artefacto persistido, sin enviar prompt ni consumir tokens:

```bash
pnpm test:e2e:notes:diagram
```

El smoke test abre Notes, selecciona ProductShape, comprueba `.generated-system-map .diagram-canvas` con `MuScriptor` y `SQLite`, y guarda `F05-T06-notes-stored-diagram.png` y `.md`.

Para iterar el renderer sin consumir otra respuesta OMP:
```bash
pnpm vitest run tests/diagrams.test.ts
```

El test de diagramas reutiliza `F05-T01-notes-productshape-cli.mermaid`.

Evidencia:

- `docs/implementation/evidence/F05-T01-notes-productshape-cli.md`
- `docs/implementation/evidence/F05-T01-notes-productshape-cli.mermaid`
- `docs/implementation/evidence/F05-T01-notes-productshape-real.png`
- `docs/implementation/evidence/F05-T02-notes-architecture-real.png`
- `docs/implementation/evidence/F05-T06-notes-stored-diagram.png`
- `docs/implementation/evidence/F05-T06-notes-stored-diagram.md`
- `docs/implementation/notes-brownfield.md`

Bloqueos y límites:

- El repo Notes tiene cambios locales preexistentes; ProjectStudio no los modifica.
- `graphify-out/GRAPH_REPORT.md` está desactualizado: fue construido sobre `e7a7fe89`, mientras el HEAD observado es `a5cb123b`.
- ProductShape y arquitectura ya producen hallazgos reales; la publicación durable en un modelo semántico editable y el timeline de artefactos quedan para el siguiente slice.

- [ ] Ejecutar `pnpm desktop:notes`.
- [ ] Confirmar que `PROYECTOS` lista `projectstudio` y `notes`, y que Notes muestra señales ProductShape/Arquitectura.
- [ ] Pulsar `＋`, elegir una carpeta y confirmar que sólo se añade una referencia local.
- [ ] Cambiar de proyecto y confirmar cambio de cwd real del worker OMP.
- [ ] Pulsar `⌫`; confirmar `archivado` y verificar que el repositorio sigue intacto.
- [ ] Volver a seleccionar el proyecto archivado; confirmar reactivación y redetección.
- [ ] Abrir `ProductShape` y confirmar que aparece el diagrama guardado en el canvas.
- [ ] Pulsar `Revisar y diagramar` arriba a la derecha; confirmar que el prompt se envía automáticamente.
- [ ] Confirmar que el chat termina en `settled` y que el usuario sólo ve progreso resumido y el resultado.

## Fases anteriores

- Fase 00: contratos RPC JSONL y spike LangGraph/SQLite.
- Fase 01: shell Electron/React, navegación, temas y Playwright.
- Fase 02: StateGraph persistente con SQLite/checkpoints.
- Fase 03: adaptador OMP v2, streaming, host tools, `steer`, `follow_up` y abort.
- Fase 04: chat Electron conectado al adaptador y respuesta visible.

## Fuera de alcance todavía

- Workbench vivo, tabs/historial y timeline durables.
- Capturas e imágenes publicadas por VAB.
- Diagramas semánticos incrementales.
- Permission Broker real y side effects externos.
- Edición Git/worktrees.

## Próximo slice

Fase 06: publicar artefactos visuales y modelos semánticos durables con scope y persistencia.
