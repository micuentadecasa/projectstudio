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
| F04-T06 | done | OMP real | `tests/e2e/desktop-real-chat.ts`, `F04-T03-desktop-chat-real.png` |

## Flujo funcionando

```text
textarea React
  → contextBridge
  → ipcMain
  → OmpAdapter
  → RpcClient
  → OMP real (modo normal) / emulador (tests explícitos)
  → message_update/message_end
  → chat visible
```

El producto requiere que el usuario tenga OMP instalado, autenticado y con modelo configurado. No se crea un perfil aislado sin credenciales ni se hace fallback silencioso al emulador.

## Verificación automatizada

| Comando | Resultado | Evidencia |
|---|---|---|
| `pnpm build:all` | pass | renderer y main Electron compilados |
| `pnpm lint` | pass | ESLint sin errores |
| `pnpm test` | pass | 5 archivos, 11 tests |
| `pnpm test:e2e` | pass | mensaje enviado con `PROJECTSTUDIO_OMP_MODE=emulator` y `fixture complete` visible |
| `pnpm test:f03` | pass | adapter RPC v2 y ciclo de sesión |
| `pnpm spike:omp-adapter` | pass | emulador explícito: ready, streaming, host tool, settled |
| `pnpm spike:omp-adapter --real` | pass | OMP real: ready, streaming, message_end, prompt_result, session_settled |
| `pnpm test:e2e:real` | pass | Electron real: 3 mensajes OMP y captura `F04-T03-desktop-chat-real.png` |

## Evidencia visual

- `docs/implementation/evidence/F04-T01-desktop-chat-dark.png`
- `docs/implementation/evidence/F04-T01-desktop-chat-light.png`
- `docs/implementation/evidence/F04-T02-desktop-chat-live.png`
- `docs/implementation/evidence/F04-T03-desktop-chat-real.png`

`F04-T02` muestra `fixture complete` con emulador. `F04-T03` muestra OMP real, `OMP_REAL_OK` y estado `settled`.

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

El modo normal inicia `omp --mode rpc` usando la configuración global del usuario, cwd del proyecto y session directory de ProjectStudio.

Para tests deterministas únicamente:

```bash
PROJECTSTUDIO_OMP_MODE=emulator pnpm test:e2e
```

Se puede seleccionar otro binario real con:

```bash
OMP_BIN=/ruta/a/omp pnpm desktop
```

## Hallazgos corregidos

1. El arranque anterior usaba `--profile projectstudio-phase04`, un perfil nuevo sin modelo. Se eliminó; ahora se reutiliza la configuración OMP del usuario.
2. La host tool real requería descripción no vacía y `parameters` como JSON Schema object. El adapter y el proceso Electron ya los envían.
3. El probe real final pasó: `ready`, negociación v2, streaming, `message_end`, `prompt_result` y `session_settled`.

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
