# ProjectStudio — estado de implementación

## Estado actual

```yaml
phase: '00'
state: WAITING_USER_APPROVAL
baselineCommit: c7cc3e5
branch: main
userDecision: null
nextPhase: '01'
```

**Regla:** `nextPhase` es sólo el siguiente gate nominal. Fase 01 no está iniciada ni aprobada.

## Inspección inicial real

- Repo: `git@github.com:micuentadecasa/projectstudio.git` (`origin` configurado).
- Branch inicial: `main`, alineada inicialmente con `origin/main`.
- Commit base inicial: `c7cc3e5` (`Initial commit`).
- Estado inicial: sólo `README.md` versionado; estaban sin trackear `AGENTS_ProjectStudio_OMP.md`, `PRD_ProjectStudio_v3.0_LangGraph_OMP_Visual.md` y `PROMPT_OMP_FASE_00.txt`.
- No existían `AGENTS.md`, `docs/PRD.md`, `package.json`, lockfile, `apps/`, `packages/`, `tests/` ni `docs/implementation/`.
- Node disponible: `v24.6.0`; pnpm disponible: `10.16.1`; Bun no estaba disponible en PATH.
- Se creó `docs/PRD.md` copiando el PRD v3 recibido, sin modificar su contenido.

## Tareas Fase 00

| ID | Estado | Superficie | Output verificable |
|---|---|---|---|
| F00-T01 | done | baseline, package manager, instrucciones | `AGENTS.md`, `.omp/RULES.md`, skills, `package.json`, `pnpm-lock.yaml`, `tsconfig.json` |
| F00-T02 | done | contratos iniciales | `packages/contracts/src/index.ts`, `tests/contracts.test.ts` |
| F00-T03 | done | OMP RPC aislado | `packages/omp-bridge/src/rpc.ts`, emulador, `tests/omp-rpc.test.ts`, decoder v2 chunk |
| F00-T04 | done | LangGraph.js + SQLite spike | `packages/orchestrator/src/sqlite-spike.ts`, `tests/langgraph-sqlite.test.ts` |
| F00-T05 | done | ADRs y dossier | `docs/adr/ADR-014…ADR-021.md`, `phase-00-evidence.md`, `PHASE-GATES.md` |
| F00-T06 | blocked | probe OMP binario real | `pnpm spike:omp:real`; binario existe pero no llega a `ready` sin modelo por `No default model selected` |

## Dependencias fijadas

- `@langchain/langgraph`: `1.5.2`
- `@langchain/langgraph-checkpoint-sqlite`: `1.1.0`
- `better-sqlite3`: resolución transitive `12.11.1` en el lockfile; requiere build nativo local
- `zod`: `4.6.7`
- `typescript`: `5.9.3`
- `vitest`: `4.0.7`
- `eslint`: `9.39.1`
- OMP local observado: `omp/18.12.6` (no dependencia npm)

## Verificación automatizada registrada

| Comando | Resultado | Nota |
|---|---|---|
| `pnpm install` | pass | dependencias instaladas; se permitió build nativo de SQLite |
| `pnpm typecheck` | pass | `tsc -p tsconfig.json --noEmit` |
| `pnpm lint` | pass | `eslint .` |
| `pnpm test` | pass | 3 files, 6 tests |
| `pnpm spike:omp` | pass | emulador determinista; ready + v2 + state |
| `pnpm spike:langgraph` | pass | SQLite real, interrupt/resume tras reconstruir el grafo |
| `pnpm spike:omp:real` | blocked | no modelo OMP seleccionado; no se inventa pass |

## Bloqueos y límites reales

1. El binario OMP instalado no emitió `ready` con el perfil aislado porque no hay modelo por defecto/configuración autenticada. No se tocó ninguna credencial ni se añadió una falsa.
2. `rpc-ui`, `set_host_tools` contra OMP real, `tool_execution_end.details`, capturas reales y SDK Bun no están validados.
3. No hay app Electron ni entorno visual en Fase 00; no hay captura UI y no se fabrica.
4. La spike LangGraph demuestra checkpoint e interrupción/resume, no idempotencia de side effects, Permission Broker, Event Store ni reanudación de una escritura.

## Checklist manual GATE-00 — pendiente del usuario

- [ ] Revisar `AGENTS.md`, `.omp/RULES.md` y las tres skills; confirmar aislamiento constructor/producto.
- [ ] Revisar `package.json`/`pnpm-lock.yaml` y confirmar que Node/pnpm y el build nativo SQLite son aceptables.
- [ ] Ejecutar `pnpm typecheck`, `pnpm lint` y `pnpm test`; confirmar salida verde.
- [ ] Ejecutar `pnpm spike:omp` y comprobar JSONL `ready` → negociación v2 → estado.
- [ ] Ejecutar `pnpm spike:langgraph` y comprobar `first.interrupted=true`, `resumed.decision=approved`, `resumed.executions=1`.
- [ ] Revisar `docs/implementation/phase-00-evidence.md` y ADR-014…ADR-021.
- [ ] Revisar explícitamente el bloqueo `pnpm spike:omp:real`; aportar un modelo/configuración OMP autorizada si se quiere cerrar F00-T06.
- [ ] Confirmar que no se inició Fase 01.
- [ ] Decidir `APPROVED`, `CHANGES_REQUESTED` o `REJECTED` para GATE-00.

## Archivos de Fase 00

- `AGENTS.md`, `.omp/RULES.md`, `.omp/skills/**`
- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.ts`, `.gitignore`
- `packages/contracts/src/index.ts`
- `packages/omp-bridge/src/rpc.ts`
- `packages/orchestrator/src/sqlite-spike.ts`
- `tests/contracts.test.ts`, `tests/omp-rpc.test.ts`, `tests/langgraph-sqlite.test.ts`, `tests/fixtures/omp-rpc-emulator.mjs`
- `scripts/run-omp-rpc-spike.ts`, `scripts/run-langgraph-sqlite-spike.ts`
- `docs/PRD.md`, `docs/implementation/PHASE-GATES.md`, `docs/implementation/phase-00-evidence.md`, `docs/adr/ADR-014…ADR-021.md`

## Candidato brownfield posterior

Se localizó un proyecto externo llamado `notes` con `AGENTS.md`, código Python, tests y documentación. Se inspeccionó sólo su listado de archivos para confirmar que existe; no se abrió, indexó, modificó ni conectó a OMP. Puede usarse como fixture brownfield después de aprobar GATE-00 y autorizar explícitamente Fase 07, con worktree/scope y evidencia separados. Fase 00 no inicia ese análisis.

## User gate

`WAITING_USER_APPROVAL`. No push will be performed. No phase transition occurs until an explicit user decision.
