# Fase 02 — dossier de evidencia

## Objetivo

Implementar el plano de control LangGraph persistente para dos workflows mock: navegación determinista e inspección con aprobación humana. El runtime usa SQLite como checkpointer y conserva `projectId`, `threadId`, `runId`, `requestId`, gate y audit log.

## Tareas

| ID | Estado | Output | Verificación |
|---|---|---|---|
| F02-T01 | done | `packages/orchestrator/src/studio-graph.ts` | StateGraph `navigate` e `inspection` compilado con SQLite |
| F02-T02 | done | `StudioGraphRuntime.start/state/resume` | runId/threadId sobreviven a un runtime nuevo |
| F02-T03 | done | `tests/studio-graph.test.ts` | approved/rejected, interrupt y no duplicación de audit |
| F02-T04 | done | `scripts/run-studio-graph-spike.ts` | smoke JSON reproducible |
| F02-T05 | done | `STATUS.md`, `PHASE-GATES.md` | documentación y GATE-02 |

## Smoke observado

Comando:

```bash
pnpm spike:studio-graph
```

Salida relevante:

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

## Tests

```bash
pnpm test:f02
```

Cubre:

- navegación completada y persistida;
- reconstrucción del runtime desde el mismo SQLite;
- interrupción `inspection` con `waiting-approval`;
- reanudación aprobada sin repetir `workflow.started`;
- rechazo persistido sin entrar al nodo de inspección.

## Limitaciones

- Los workflows son mocks deterministas; no conectan todavía UI, OMP, cloud ni Permission Broker.
- No se ejecutan side effects externos; la idempotencia de efectos reales permanece para fases posteriores.
- Fase 02 no cambia la UI, por lo que no genera nuevas capturas. Las capturas Fase 01 siguen siendo la evidencia visual vigente.
