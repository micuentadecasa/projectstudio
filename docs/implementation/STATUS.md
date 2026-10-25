# ProjectStudio — estado de implementación

## Estado actual

```yaml
phase: '07'
state: WAITING_USER_APPROVAL
baselineCommit: ea016ff
branch: main
gate: F07-REAL-OMP-PDAC-CANVAS
userDecision: APPROVED
nextPhase: '07'
latestVerifiedCommit: ea016ff
manualVerification: required
```
El flujo F07 valida OMP real, personalidad con temporizador, persistencia de proyecto y lienzos Tldraw no vacíos después de cada actividad OMP. Esta iteración queda preparada para revisión manual; no se hizo push.
Esta iteración añade una capa determinista inspirada en verification-skill-example: primero se validan manifiesto, grafo persistido y contratos de UI leyendo archivos; no se lanza Electron ni se invoca OMP. El runtime real queda reservado para las comprobaciones que necesitan DOM, IPC, Tldraw o semántica generada por el modelo.
El usuario pidió commits directos a `main`, sin push, y continuar sin pausas entre gates.
Notes quedó deliberadamente sin `.product/` ni `docs/product/` para iniciar el siguiente smoke como Greenfield; la copia reversible está en `/Users/luis/projects/notes-pdac-backup-202603/`.
La ejecución real pendiente no es sustituible por lectura estática: hay que volver a crear el PDAC con OMP, aprobar focos y comprobar visualmente cada lienzo.

## Fase 07 — personalidad, persistencia y comprobación visual del lienzo

| ID | Estado | Superficie | Output verificable |
|---|---|---|---|
| F07-T01 | done | timer de personalidad | `docs/implementation/evidence/F07-personality-timer-report.json`; OMP real, umbral 10 s |
| F07-T02 | done | seguridad del chat | el timer no dispara con texto pendiente; prompts internos no aparecen |
| F07-T03 | done | matriz brownfield/greenfield | `tests/e2e/pdac-matrix-20.ts`; 20/20 escenarios, 8 artefactos por escenario, `repositoriesModified: false` |
| F07-T04 | done | comprobación post-OMP | el E2E espera mensaje OMP nuevo y `data-chat-status="settled"`; después exige una figura Tldraw visible o la vista editable de recuperación antes de capturar evidencia |
| F07-T05 | done | edición Tldraw → PDAC | edición humana del shape actualiza `.product/generated/product-graph.json`; escrituras serializadas |
| F07-T06 | done | reanudación | cierre y reapertura restauran proyecto y foco PDAC |
| F07-T07 | done | manual | README documenta OMP real, timer, persistencia y edición del lienzo |
| F07-T08 | done | verificación sin app | `.cursor/skills/verify-projectstudio/`, `scripts/verify-pdac-static.ts`, `scripts/verify-pdac-scenarios.ts`; no Electron ni tokens |
| F07-T09 | done | contrato UI estático | `scripts/verify-ui-contract.ts`; timer, target elegido, botones bloqueados y canvas filtrado |
| F07-T10 | done | foco de artefacto | Actores y demás pantallas de foco muestran el canvas filtrado; el detalle largo queda sólo en Resumen |
| F07-T11 | pending-manual | reejecución real | requiere una sesión OMP real para crear de nuevo el PDAC de Notes desde Greenfield; no se lanza por esta iteración |

### Evidencia y límite conocido

- El E2E comprueba el lienzo después de cada respuesta OMP: espera `settled`, valida una figura Tldraw visible o activa la vista editable de recuperación, comprueba el foco y captura evidencia antes de continuar.
- La matriz usa OMP real; no usa mocks ni prompts simulados. Los repositorios temporales se eliminan al finalizar y `repositoriesModified` es `false`.
- Si Tldraw conserva figuras en su store pero no las pinta en el DOM, la UI no queda en blanco: muestra una vista de recuperación editable y mantiene el guardado de títulos hacia PDAC. Tldraw vuelve a ocultarla cuando su figura DOM aparece.

### Checklist manual F07

- [x] Ejecutar `pnpm verify:pdac:scenarios`; matriz determinista 20 escenarios, 10 Greenfield y 10 Brownfield.
- [x] Ejecutar `PROJECTSTUDIO_PROJECT_ROOT=/Users/luis/projects/notes pnpm verify:pdac:static -- --expect-greenfield`; Notes no contiene PDAC persistido.
- [x] Ejecutar `pnpm verify:ui:static`, `pnpm typecheck`, `pnpm typecheck:desktop`, `pnpm lint` y `git diff --check`.
- [ ] Con OMP real, iniciar la entrevista Greenfield de Notes; aprobar cada foco y comprobar que cada aprobación escribe el grafo.
- [ ] En Actores, confirmar que se ve sólo el diagrama de actores y que el chat contiene la explicación.
- [ ] Tras el timer, confirmar el mensaje `Sigo con ...`, target visible y botones deshabilitados durante el trabajo.
- [ ] Cerrar/reabrir y ejecutar la lectura estática en modo Brownfield para verificar el grafo final.

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
| F05-T11 | done | personalidad visible del Arquitecto de Proyecto, objetivos sugeridos dentro del chat y composer visible |
| F05-T12 | done | `docs/implementation/JOURNEY-BROWNFIELD.md`: journey brownfield, reglas de orden y smoke asociado |
| F05-T13 | done | discovery interrumpido se marca reanudable; no deja objetivos bloqueados por un marcador stale |
| F05-T14 | done | escenarios humanos: proyecto existente, referencia nueva, discovery activo, cola de objetivo y error OMP comprensible |
| F05-T15 | done | estado/progreso de ProductShape subido encima del contenido principal |
| F05-T16 | done | panel `Lo que va encontrando` deriva hallazgos del informe real y conserva rutas de evidencia |
| F05-T17 | done | diagramas almacenados se distinguen de revisiones `provisional`; el usuario puede volver a una revisión temporal |
| F05-T18 | done | Mermaid se publica desde el streaming antes de cerrar el fence; el fallback comunica cuándo aún no hay diagrama |
| F05-T19 | done | panel ProductShape reordenado como timeline vivo; diagrama ocupa el ancho principal y anuncia casos de uso nuevos durante streaming |
| F05-T20 | done | botones del estado PDAC abren páginas de Casos de uso, Actores, Reglas y Bounded contexts y conservan el mapa |
| F05-T21 | done | páginas de entidad muestran conteo de hallazgos, filtro contextual y acción `Profundizar con OMP`; el estado Notes pasa a 5/5 áreas con evidencia |
| F05-T22 | done | durante el streaming el centro muestra actividad segura del OMP, hallazgos parciales y mapa incremental de evidencia antes del Mermaid final |
| F05-T23 | done | guía PDAC calcula el siguiente foco pendiente, alinea el contador con los hallazgos filtrables y elimina el status superior duplicado de ProductShape |
| F05-T24 | done | resultado de descubrimiento resume hechos, inferencias y pendientes; cada hallazgo conserva su ruta de evidencia y etiqueta visible |
| F05-T25 | done | ProductShape usa un único timeline de actividad central y el shell fija `100vh` con `.content-scroll` flexible y desplazable para alcanzar confirmación, resultados y diagramas |
### Verificación F05

```bash
pnpm spike:notes:productshape
```

Resultado observado: pass. El CLI de OMP real trabajó con `projectRoot=/Users/luis/projects/notes`, estado `settled`, protocolo 2, respuesta de 15.075 caracteres y Mermaid extraído de 1.207 caracteres.

`pnpm test:f04` pasó con Electron real: el worker LangGraph invocó OMP, la respuesta final llegó al chat y no se filtró el prompt interno.
`pnpm exec tsx tests/e2e/notes-brownfield.ts` pasó con OMP real: ProductShape respondió, el chat mostró el Mermaid y el canvas recibió el diagrama. La prueba cubre además arquitectura posterior y dejó capturas F05-T01/F05-T02.


Verificación visual del artefacto persistido, sin enviar prompt ni consumir tokens:

```bash
pnpm test:e2e:notes:diagram
```

El smoke test abre Notes, selecciona ProductShape, comprueba `.generated-system-map .diagram-canvas` con `MuScriptor` y `SQLite`, y guarda `F05-T06-notes-stored-diagram.png` y `.md`.
El mismo smoke navega a las páginas `Casos de uso` y `Actores`, comprueba el banner `ENTIDAD PDAC`, vuelve al estado y confirma que el mapa sigue disponible.


Journey humano completo, sin mostrar prompts internos:

```bash
pnpm test:e2e:journey:scenarios
```

Resultado observado: `existing-notes`, `new-project-reference`, `active-discovery-queues-objective` y `omp-error` pasan. El caso OMP ausente muestra una instrucción accionable y no expone `ENOENT`.

La captura `F05-T06-notes-stored-diagram.png` confirma que ProductShape concentra el estado en `PDAC · ESTADO ACTUAL`, la guía `GUÍA PDAC · SIGUIENTE PASO`, el resumen del descubrimiento y el mapa, sin duplicar el status superior.
El recorrido asistido de ProductShape también se comprobó con el artefacto real almacenado:

```bash
pnpm test:e2e:notes:diagram
```

Resultado observado: el panel `Lo que va encontrando` muestra hallazgos derivados de `F05-T01-notes-productshape-real.md`, mantiene rutas como `docs/product/README.md:3-15` y distingue el diagrama como `EVIDENCIA GUARDADA`. No consumió tokens.

ADR asociado: `docs/adr/ADR-025-productshape-assistant-revisions.md`.


Para iterar el renderer sin consumir otra respuesta OMP:
```bash
pnpm vitest run tests/diagrams.test.ts
```

El test de diagramas reutiliza `F05-T01-notes-productshape-cli.mermaid`.
La regresión de streaming se cubre con `tests/diagrams.test.ts`: un bloque Mermaid sin fence de cierre ya se puede renderizar como vista provisional.


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

## Fase 06 — Greenfield, entidades PDAC y jerarquía visual

| ID | Estado | Output verificable |
|---|---|---|
| F06-T01 | done | `docs/implementation/JOURNEY-GREENFIELD.md` define el journey brownfield/greenfield y el escenario reproducible |
| F06-T02 | done | `apps/desktop/src/main.ts` detecta carpetas vacías y persiste `mode: greenfield` sin modificar el repositorio |
| F06-T03 | done | `tests/e2e/greenfield.ts` y `tests/fixtures/greenfield-empty/` cubren la entrevista inicial con OMP real; captura/texto se generan al ejecutar |
| F06-T04 | done | ProductShape usa barra de iconos con contador para Propósito, Actores, Casos de uso, Dominio, Journeys, Reglas, Requisitos y Bounded contexts |
| F06-T05 | done | ProductShape elimina el hero duplicado, conserva una sola línea de actividad, spinner sticky y reserva más área central al mapa |
| F06-T06 | done | `ADR-026-greenfield-pdac-interview-and-proactive-review.md` documenta modo, entrevista, personalidad, superficies dinámica/estática y revisión temporal |
| F06-T07 | done | `pnpm test:e2e:greenfield` pasó con OMP real, fixture limpia, entrevista y reapertura; evidencia `F06-T03-greenfield-interview.png/.md` |
| F06-T08 | pending | Revisión manual de scroll, legibilidad del mapa y confirmación de que las preguntas PDAC no exponen prompts internos |
| F06-T09 | done | El grafo `.product/generated/product-graph.json` del proyecto es la fuente de verdad al reabrir; `.tmp/project-analysis/` queda como fallback y se recalcula la firma de cambios |
| F06-T10 | done | El chat formatea texto y remite al mapa central; no duplica el Mermaid completo |
| F06-T11 | done | El foco actual ocupa la superficie principal; `Estado general` devuelve al resumen y Dominio muestra glosario debajo del grafo |
| F06-T12 | done | La personalidad se separa en `PROJECT_ARCHITECT_PERSONA` y `PROJECT_ARCHITECT_CONDUCT`; incluye objetivo actual, foco único, hechos/inferencias y revisión proactiva |
| F06-T13 | done | `docs/research/openclaw-personality.md` recoge fuentes first-party y justifica identidad separada, memoria trazable y proactividad como job |
| F06-T14 | done | Cada artefacto PDAC tiene canvas tldraw editable y persistente por proyecto/entidad en IndexedDB; traducción/assets de UI locales; evidencia `F05-T06-notes-actors-tldraw.png` |
| F06-T15 | done | `tests/e2e/greenfield-scenarios.ts` ejecuta tres ideas nuevas con OMP real, captura cada entrevista y elimina cada carpeta temporal y sus referencias |
| F06-T16 | done | `tests/e2e/brownfield-projects.ts` revisa `pianolesson` y `pinto` con OMP real, navega sus artefactos y no modifica los repositorios |
| F06-T17 | done | `tests/e2e/session-persistence.ts` cierra/reabre Electron y conserva `/Users/luis/projects/notes`, ProductShape y foco Actores; evidencia `F06-T18-session-before-close.png`/`after-reopen.png` |
| F06-T18 | done | `tests/e2e/ux-scenarios.ts` ejecuta Brownfield Notes y Greenfield taller con OMP real; captura cada paso y verifica foco central, estado único, chat sin prompts internos y diagrama actualizado; evidencia en `docs/implementation/evidence/ux-scenarios/` |
| F06-T19 | done | el mapa general y cada artefacto PDAC usan tldraw offline cuando hay hallazgos; cada lienzo se persiste por proyecto/entidad y se puede editar a mano |
| F06-T20 | done | `tests/e2e/notes-pdac-lifecycle.ts` copia el PDAC de Notes a una fixture, verifica carga, añade un caso de uso, cierra/reabre, navega cuatro artefactos, elimina el grafo y verifica la recuperación sin tocar Notes |

### Verificación F06

Pasadas observadas:

```bash
pnpm build:all
pnpm lint
pnpm typecheck
pnpm typecheck:desktop
pnpm test:e2e:notes:diagram
pnpm test:e2e:greenfield
pnpm exec tsx tests/e2e/greenfield-scenarios.ts
pnpm test:e2e:brownfield:projects
pnpm test:e2e:session
pnpm test:e2e:ux
pnpm test:e2e:notes:pdac-lifecycle
```

`notes:diagram` pasó sin tokens: abre Notes y carga el grafo actual de `.product/generated/product-graph.json` (52 nodos y 145 relaciones en la ejecución), no el informe antiguo de `.tmp`; conserva el mapa, navega a Casos de uso/Actores/Dominio y monta canvas tldraw.
`greenfield` pasó con OMP real: la fixture vacía inicia la entrevista, guarda respuesta/captura y reabre el proyecto.
Los tres Greenfield adicionales pasaron con OMP real: biblioteca musical, reservas de taller e inventario de huerto. Cada respuesta separó confirmados, inferencias e incógnitas; las carpetas y referencias temporales se eliminaron.
El Brownfield multi-proyecto ejecutó OMP real sobre `pianolesson` y `pinto`, llegó al resultado central, mantuvo el Mermaid fuera del chat y abrió las páginas de Actores, Casos de uso, Dominio y Journeys. Los repositorios no se modificaron.
`pnpm test:e2e:session` pasó: tras cerrar Electron, el siguiente arranque sin `PROJECTSTUDIO_PROJECT_ROOT` recuperó `notes`, la pestaña `ProductShape` y el foco `Actores`. La selección del proyecto activo se conserva en el registro local y la fase/foco en `localStorage` por proyecto.
La nueva superficie unifica el estado: el chat ya no duplica `.chat-activity`; el resultado OMP se muestra como mensaje streaming y el centro cambia a ProductShape antes de enviar cualquier workflow brownfield. El resumen ya no contiene la tarjeta `Asistente de ProductShape`; cuando hay hallazgos muestra el mapa general en un lienzo tldraw offline.
`pnpm test:e2e:ux` pasó con OMP real sobre Notes y una Greenfield desechable; generó `docs/implementation/evidence/ux-scenarios/` con cuatro capturas y checks automáticos de foco central, estado único, chat sin prompts internos y diagrama actualizado.
`pnpm test:e2e:notes:pdac-lifecycle` pasó: una copia efímera del PDAC de Notes recuperó el grafo, aceptó un nuevo caso de uso, lo mantuvo al reabrir, montó los cuatro lienzos y dejó de reportar recuperación al eliminar el grafo fuente. La fixture y sus referencias se eliminaron; Notes quedó intacto.
La compilación de tldraw muestra avisos de bundle grande (2.0 MB minificado) y directivas `use client` ignoradas por Vite; no son errores de compilación. La build no licenciada intenta además cargar su watermark CDN, pero la CSP lo bloquea y no impide editar ni persistir el lienzo; eliminar esa petición requiere licencia/configuración de tldraw o sustituir esa parte de la UI.

### Checklist manual F06

- [ ] Abrir `PROJECTSTUDIO_PROJECT_ROOT=/Users/luis/projects/notes pnpm desktop` y entrar en ProductShape.
- [ ] Confirmar que ya no aparece un hero superior repetido; la navegación PDAC queda en una barra de iconos con contadores.
- [ ] Confirmar que `Revisar` está arriba, que el centro muestra una sola línea de actividad y que el mapa ocupa más espacio.
- [ ] Pulsar `Casos de uso`, `Actores`, `Dominio`, `Reglas` y `Bounded contexts`; confirmar filtros, `Profundizar con OMP` y el lienzo editable específico.
- [ ] En un lienzo de Actores o Journeys, arrastrar un nodo, editar su texto y dibujar una relación; cerrar y reabrir para confirmar persistencia local.
- [ ] Añadir `tests/fixtures/greenfield-empty/` como proyecto; confirmar `greenfield`, `Cuéntame el primer caso de uso` y el botón `Empezar`.
- [ ] Escribir un caso de uso; confirmar que OMP pregunta una decisión cada vez y que el prompt interno no aparece.
- [ ] Confirmar que no se ofrece comparar arquitecturas antes de tener PDAC.
- [ ] En brownfield, dejar la ventana 15 minutos sin interacción después de un hallazgo; confirmar un único repaso breve y no una cascada de llamadas.
- [ ] Contraer/expandir `EXPLORADOR`; confirmar que conserva iconos, tooltips y libera ancho central.
- [ ] Ejecutar `pnpm test:e2e:ux`; revisar cada PNG: siguiente paso obvio, chat y centro en el mismo foco, diagrama actualizado y ningún prompt interno.
- [ ] Con hallazgos visibles en Resumen, editar manualmente un nodo en el lienzo tldraw; cerrar/reabrir y confirmar que el cambio local sigue presente.
- [ ] Cerrar y abrir la app sin `PROJECTSTUDIO_PROJECT_ROOT`; confirmar que vuelve al proyecto activo y al mismo foco PDAC.

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

## ProductShape canónico de ProjectStudio

Se creó `docs/product/` como fuente documental del producto actual. Incluye propósito y frontera, actor, casos de uso de descubrimiento y reanudación, requisito de clasificación de evidencia, restricción local-first, journey brownfield y bounded context de Project Discovery.

`docs/PRD.md` sigue siendo la especificación integral y enlaza explícitamente este modelo. La documentación marca la diferencia entre comportamiento aceptado, capacidades propuestas e incógnitas; no convierte la evidencia de Notes en evidencia de ProjectStudio.

Verificación observada:

- `pnpm build:all`: pass; Vite mantiene los avisos existentes de directivas `use client` y tamaño de bundle.
- `pnpm lint`: pass.
- `docs/product/` contiene 9 archivos y la detección de señales del proyecto ahora puede encontrar `docs/product`.

El test unitario completo sigue con el fallo previo de `tests/agent-runtime.test.ts`: espera texto de personalidad antiguo y no está relacionado con este cambio documental.
