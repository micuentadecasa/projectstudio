# Gates de implementación

## GATE-00

Entrada: repositorio inspeccionado, stack fijado y ningún trabajo de Fase 01 iniciado.

Salida requerida:

- `AGENTS.md`, `.omp/RULES.md` y skills del constructor versionados.
- Dependencias y versiones fijadas en `package.json`/`pnpm-lock.yaml`.
- Contratos iniciales tipados y validados.
- Spike OMP JSONL reproducible con emulador; probe real documentado.
- Spike LangGraph.js + SQLite con interrupt/resume tras reconstruir el grafo.
- ADR-014…ADR-021 redactados.
- `STATUS.md` en `WAITING_USER_APPROVAL`.
- Ningún shell Electron/React, workflow de producto o implementación de Fase 01.

Decisión humana: `APPROVED`, `CHANGES_REQUESTED` o `REJECTED`. El silencio no aprueba.
