# ProjectStudio — estado de implementación

## Estado actual

```yaml
phase: '02'
state: WAITING_USER_APPROVAL
baselineCommit: 1aea0a9
branch: main
gate: GATE-02
userDecision: null
nextPhase: '03'
```

La instrucción del usuario «sigue creando» se toma como aprobación explícita de GATE-01. Fase 02 fue la única fase activa. Fase 03 no está iniciada.

## Fase 02 — tareas

| ID | Estado | Superficie | Output verificable |
|---|---|---|---|
| F02-T01 | done | StateGraph | `packages/orchestrator/src/studio-graph.ts`: rutas `navigate` e `inspection` |
| F02-T02 | done | persistencia | `StudioGraphRuntime` con SQLite, `threadId`, `runId` y reapertura |
| F02-T03 | done | gates mock | `interrupt()` + `resume(approved/rejected)` y audit log |
| F02-T04 | done | smoke/tests | `tests/studio-graph.test.ts`, `scripts/run-studio-graph-spike.ts` |
| F02-T05 | done | documentación | `phase-02-evidence.md`, `PHASE-02-PLAN.md`, `PHASE-GATES.md` y este STATUS |

## Verificación automatizada

| Comando | Resultado | Evidencia |
|---|---|---|
| `pnpm typecheck` | pass | TypeScript del repo y workflow |
| `pnpm test:f02` | pass | navegación, persistencia, approval/rejection y audit log |
| `pnpm spike:studio-graph` | pass | SQLite real; interrupt → reopen → approved |
| `pnpm build:all` | pass | TypeScript repo + Vite/Electron desktop |
| `pnpm test:e2e` | pass | Electron real; Fase 02 no cambia UI |
| `pnpm lint` | pass | `eslint .` |
| `pnpm test` | pass | 4 archivos, 9 tests |

## Smoke observado

```json
{
  "pending": {
    "interrupted": true,
    "runId": "run-f02-smoke",
    "jobStatus": "waiting-approval",
    "gateStatus": "pending"
  },
  "approved": {
    "runId": "run-f02-smoke",
    "jobStatus": "completed",
    "result": "inspected:repository:repo-demo",
    "auditKinds": [
      "workflow.started",
      "gate.approved",
      "inspection.completed"
    ]
  }
}
```

## Alcance implementado

- `navigate`: abre una vista determinista y completa con resultado auditable.
- `inspection`: se detiene en `waiting-approval` mediante `interrupt()`.
- Reanudación con `Command({ resume })` mediante la interfaz `resume()`.
- Decisiones `approved` y `rejected` persistidas.
- Checkpoints SQLite reabiertos desde un runtime nuevo.
- `runId` estable durante todo el workflow.
- `auditLog` durable y sin repetir `workflow.started` al reanudar.

## Limitaciones reales

1. Los workflows son mocks deterministas; no conectan todavía UI, OMP, cloud ni Permission Broker.
2. No se ejecutan side effects externos; la idempotencia de efectos reales queda pendiente.
3. La UI Fase 01 no cambia en esta fase; no se generaron nuevas capturas.
4. El chat sigue siendo demo local. La conexión OMP real continúa bloqueada por ausencia de modelo configurado.
5. El proyecto `notes` no se analiza ni modifica.

## Evidencia visual vigente

Fase 02 no cambia la superficie visual. Se mantienen las capturas reales de Fase 01:

- `docs/implementation/evidence/F01-T03-desktop-dark.png`
- `docs/implementation/evidence/F01-T03-desktop-light.png`

## Checklist manual GATE-02 — pendiente del usuario

- [ ] Ejecutar `pnpm test:f02` y revisar los 3 tests específicos de `StudioGraphRuntime`.
- [ ] Ejecutar `pnpm spike:studio-graph` y comprobar `pending.interrupted=true`.
- [ ] Comprobar que `pending.runId` y `approved.runId` son iguales.
- [ ] Comprobar `pending.jobStatus=waiting-approval` y `pending.gateStatus=pending`.
- [ ] Comprobar resultado aprobado `inspected:repository:repo-demo`.
- [ ] Revisar `auditKinds` y confirmar ausencia de un segundo `workflow.started`.
- [ ] Revisar `packages/orchestrator/src/studio-graph.ts` y `docs/implementation/phase-02-evidence.md`.
- [ ] Ejecutar la regresión `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`.
- [ ] Confirmar que no se inició Fase 03 ni se conectó OMP real.
- [ ] Decidir `APPROVED`, `CHANGES_REQUESTED` o `REJECTED` para GATE-02.

## Historial

- Base inicial: `c7cc3e5`.
- Fase 00: `0a4a2bf chore: bootstrap phase 00 contracts and spikes`.
- Fase 01: `1aea0a9 feat: add phase 01 electron react shell`.
- README: `4c253a0 docs: add desktop run instructions`.

## User gate

`WAITING_USER_APPROVAL`. No push será realizado. No se inicia Fase 03 hasta una decisión explícita del usuario.
