# Fase 01 — dossier de evidencia

## Objetivo

Shell Electron/React usable con navegación, tema, menú, proyecto demo, chat local de demostración y paneles redimensionables. No implementa OMP real, LangGraph persistente ni brownfield; esos alcances permanecen en fases posteriores.

## Tareas

| ID | Estado | Output | Verificación |
|---|---|---|---|
| F01-T01 | done | `apps/desktop/src/main.ts`, `apps/desktop/preload.cjs`, `vite.config.ts` | Electron arranca con aislamiento de contexto y menú nativo |
| F01-T02 | done | `apps/desktop/src/renderer/main.tsx`, `styles.css` | shell visual: explorador, tabs, canvas/resumen, chat y statusbar |
| F01-T03 | done | `tests/e2e/desktop-smoke.ts`, capturas PNG | Playwright abre Electron, cambia tema, navega y envía mensaje demo |
| F01-T04 | done | `docs/implementation/STATUS.md`, `PHASE-GATES.md` | gate y checklist manual actualizados |

## Artefactos visuales

- `docs/implementation/evidence/F01-T03-desktop-dark.png` · SHA-256 `2dfcbb53aa761b1e8bafa78b77c6969db0d85c568c56e5490ae88e537eb1dddb`
- `docs/implementation/evidence/F01-T03-desktop-light.png` · SHA-256 `f7dc1b1963ecd02a7413fc3e6add7c8627df1d6fa72029af0d239f662d84438b`

Las capturas son generadas por Electron real y Playwright; no son mockups.

## Comandos

```bash
pnpm build:desktop
pnpm typecheck:desktop
pnpm test:e2e
```

## Limitaciones

- El selector `notes · brownfield pendiente` es sólo una etiqueta de demo: no lee ni modifica ese proyecto.
- El chat responde localmente para demostrar la superficie; no invoca OMP real.
- El estado no se persiste aún; Fase 02 cubre LangGraph/checkpoints.
