# ProjectStudio — estado de implementación

## Estado actual

```yaml
phase: '04'
state: IN_PROGRESS
baselineCommit: b041d19
branch: main
gate: GATE-04
userDecision: APPROVED
nextPhase: '05'
```

El usuario autorizó continuar sin pausas entre gates. Fase 04 queda implementada y verificada; no se requiere una nueva aprobación para seguir con el siguiente slice.

## Fase 04 — chat OMP visible

| ID | Estado | Superficie | Output verificable |
|---|---|---|---|
| F04-T01 | done | puente Electron | `apps/desktop/src/main.ts`, `apps/desktop/preload.cjs` |
| F04-T02 | done | chat React | `apps/desktop/src/renderer/main.tsx` |
| F04-T03 | done | tipos/estilos | `renderer.d.ts`, `styles.css` |
| F04-T04 | done | integración | renderer → IPC → OmpAdapter → RPC → renderer |
| F04-T05 | done | evidencia | `F04-T01-desktop-chat-*.png`, `F04-T02-desktop-chat-live.png` |

## Flujo funcionando

```text
textarea React
  → contextBridge
  → ipcMain
  → OmpAdapter
  → RpcClient
  → emulador OMP RPC v2
  → message_update/message_end
  → chat visible
```

La respuesta `fixture complete` aparece en la UI después de enviar una pregunta desde Playwright. El emulador queda etiquetado como `EMULADOR`; no se presenta como modelo real.

## Verificación automatizada

| Comando | Resultado | Evidencia |
|---|---|---|
| `pnpm build:all` | pass | renderer y main Electron compilados |
| `pnpm lint` | pass | ESLint sin errores |
| `pnpm test` | pass | 5 archivos, 11 tests |
| `pnpm test:e2e` | pass | mensaje enviado y `fixture complete` visible |
| `pnpm test:f03` | pass | adapter RPC v2 y ciclo de sesión |
| `pnpm spike:omp-adapter` | pass | emulador: ready, streaming, host tool, settled |
| `pnpm spike:omp-adapter --real` | blocked | OMP real sin modelo configurado |

## Evidencia visual

- `docs/implementation/evidence/F04-T01-desktop-chat-dark.png`
- `docs/implementation/evidence/F04-T01-desktop-chat-light.png`
- `docs/implementation/evidence/F04-T02-desktop-chat-live.png`

La última captura muestra `¿Qué componentes tiene este proyecto?` y la respuesta `fixture complete` en el panel OMP, con estado `settled`.

## Cómo ejecutarlo

Modo reproducible local, por defecto:

```bash
pnpm desktop
```

Modo real, cuando exista un modelo autorizado:

```bash
PROJECTSTUDIO_OMP_MODE=real pnpm desktop
```

Se puede seleccionar otro binario con:

```bash
OMP_BIN=/ruta/a/omp PROJECTSTUDIO_OMP_MODE=real pnpm desktop
```

## Bloqueo real conocido

El binario local `omp/18.12.6` sigue terminando antes de `ready`:

```text
No default model selected.
Use /login, set an API key environment variable, or select a local model with /model or --model.
```

No se modificaron credenciales. El modo emulador sirve para validar el circuito visual y de eventos; no sustituye la validación del modelo real.

## Fases anteriores

- Fase 00: contratos, RPC JSONL, emulador y spike LangGraph/SQLite.
- Fase 01: shell Electron/React, navegación, temas y Playwright.
- Fase 02: StateGraph persistente con SQLite/checkpoints.
- Fase 03: adaptador OMP v2, streaming, host tools, `steer`, `follow_up` y abort.
- Fase 04: chat Electron conectado al adaptador y respuesta visible.

## Fuera de alcance todavía

- Workbench vivo, tabs/historial y timeline durables.
- Capturas e imágenes publicadas por VAB.
- Diagramas semánticos incrementales.
- Brownfield real sobre `notes`; el selector de UI sigue siendo demo y no se ha modificado ese proyecto.
- Permission Broker real y side effects externos.
- Edición Git/worktrees.

## Próximo slice

Fase 05: preparar la ruta de artefactos visuales/capturas con validación de scope y persistencia, sin inventar compatibilidad de tools que el OMP real no haya demostrado.
