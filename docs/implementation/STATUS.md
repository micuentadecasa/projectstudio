# ProjectStudio — estado de implementación

## Estado actual

```yaml
phase: '01'
state: WAITING_USER_APPROVAL
baselineCommit: 0a4a2bf
branch: main
gate: GATE-01
userDecision: null
nextPhase: '02'
```

La instrucción del usuario «sigue con el plan» se toma como aprobación explícita de GATE-00. Fase 01 fue la única fase activa. Fase 02 no está iniciada.

## Fase 01 — tareas

| ID | Estado | Superficie | Output verificable |
|---|---|---|---|
| F01-T01 | done | runtime Electron | `apps/desktop/src/main.ts`, `apps/desktop/preload.cjs`, menú nativo, aislamiento de contexto |
| F01-T02 | done | shell React | `apps/desktop/src/renderer/main.tsx`, `styles.css`, tabs, navegación, tema y chat demo |
| F01-T03 | done | smoke visual | `tests/e2e/desktop-smoke.ts`, capturas PNG reales de Electron |
| F01-T04 | done | documentación/gate | `phase-01-evidence.md`, `PHASE-GATES.md`, este STATUS |

## Verificación automatizada

| Comando | Resultado | Evidencia |
|---|---|---|
| `pnpm build:desktop` | pass | Vite + TypeScript compilan renderer y Electron Main |
| `pnpm typecheck:desktop` | pass | tipos del proceso Electron |
| `pnpm typecheck` | pass | contratos/scripts/tests del repo |
| `pnpm lint` | pass | `eslint .` |
| `pnpm test` | pass | 3 archivos, 6 tests Fase 00 |
| `pnpm test:e2e` | pass | Electron real; título, navegación, tema, paneles resize y chat demo |
| `pnpm test:f01` | pass | build desktop + smoke Playwright |

Salida observada del smoke:

```json
{
  "title": "ProjectStudio",
  "activeSection": "Arquitectura",
  "theme": "app-shell light",
  "screenshots": [
    "docs/implementation/evidence/F01-T03-desktop-dark.png",
    "docs/implementation/evidence/F01-T03-desktop-light.png"
  ]
}
```

## Evidencia visual

- `docs/implementation/evidence/F01-T03-desktop-dark.png`
  - SHA-256: `2dfcbb53aa761b1e8bafa78b77c6969db0d85c568c56e5490ae88e537eb1dddb`
- `docs/implementation/evidence/F01-T03-desktop-light.png`
  - SHA-256: `f7dc1b1963ecd02a7413fc3e6add7c8627df1d6fa72029af0d239f662d84438b`

Las capturas fueron generadas por Electron real y Playwright; no son mockups.

## Alcance implementado

- Ventana Electron de 1440×920 con mínimos de 1120×720.
- Renderer React sin Node APIs; preload CommonJS aislado con `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- Menú nativo `ProjectStudio` y `Ver`.
- Explorador lateral con proyecto demo, navegación de Resumen, ProductShape, Arquitectura, Evidencia y Cambios.
- Tabs de Resumen, ProductShape y Arquitectura.
- Paneles laterales con `resize: horizontal`.
- Tema oscuro/claro.
- Chat local demo con contexto de vista, envío de mensaje y respuesta claramente marcada como demo.
- Proyecto `notes` sólo aparece como etiqueta de demo; no se lee ni modifica.

## Limitaciones reales

1. El chat no invoca OMP real. La conexión RPC real sigue bloqueada por ausencia de modelo configurado, según Fase 00.
2. El estado de UI no persiste entre reinicios. Eso pertenece a Fase 02.
3. El selector `notes · brownfield pendiente` no ejecuta brownfield. Su análisis queda para una fase posterior autorizada.
4. No hay LangGraph persistente, Event Store, Permission Broker ni host tools en esta fase.
5. La captura valida la superficie visual; no constituye evidencia de OMP real ni de datos semánticos canónicos.

## Candidato brownfield posterior

El proyecto externo `notes` fue localizado y sólo se inspeccionó su listado: `AGENTS.md`, código Python, tests y documentación. No se abrió, indexó, modificó ni conectó a OMP. Se podrá usar con scope/worktree explícitos cuando corresponda a la fase brownfield.

## Checklist manual GATE-01 — pendiente del usuario

- [ ] Ejecutar `pnpm desktop` y confirmar que abre la ventana Electron.
- [ ] Cambiar entre Resumen, ProductShape, Arquitectura, Evidencia y Cambios.
- [ ] Cambiar tema oscuro/claro y revisar contraste.
- [ ] Arrastrar el borde del explorador izquierdo y del chat derecho; confirmar que ambos redimensionan.
- [ ] Cambiar el proyecto demo en el selector.
- [ ] Abrir tabs de ProductShape y Arquitectura; regresar a Resumen.
- [ ] Escribir en el chat y pulsar Enviar; confirmar respuesta etiquetada como demo local.
- [ ] Abrir menú `ProjectStudio` y menú `Ver`; confirmar Reload, DevTools y fullscreen.
- [ ] Revisar ambos PNG en `docs/implementation/evidence/` y sus hashes.
- [ ] Confirmar que el texto `OMP preparado · RPC aislado · Fase 03` no se interpreta como OMP conectado.
- [ ] Confirmar que no se inició Fase 02 ni el análisis brownfield de `notes`.
- [ ] Decidir `APPROVED`, `CHANGES_REQUESTED` o `REJECTED` para GATE-01.

## Historial Fase 00

- Base inicial: commit `c7cc3e5`, branch `main`, sólo `README.md` versionado.
- Entregables Fase 00: `AGENTS.md`, `.omp/RULES.md`, skills, contratos Zod, decoder/emulador OMP RPC, spike LangGraph SQLite, ADR-014…ADR-021 y dossier.
- Commit Fase 00: `0a4a2bf chore: bootstrap phase 00 contracts and spikes`.
- F00-T06 continúa bloqueado: el binario local `omp/18.12.6` no emite `ready` sin modelo seleccionado.

## User gate

`WAITING_USER_APPROVAL`. No push será realizado. No se inicia Fase 02 hasta una decisión explícita del usuario.
