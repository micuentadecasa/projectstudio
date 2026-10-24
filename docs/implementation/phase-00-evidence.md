# Fase 00 — dossier de evidencia

## Evidencia automatizada

| ID | Artefacto | Comando | Resultado esperado |
|---|---|---|---|
| F00-T01 | `package.json`, `pnpm-lock.yaml`, `tsconfig.json` | `pnpm install`, `pnpm typecheck` | dependencias instaladas y tipos correctos |
| F00-T02 | `packages/contracts/src/index.ts` | `pnpm test -- tests/contracts.test.ts` | contratos Zod aceptan estado válido y rechazan `kind=html` |
| F00-T03 | `packages/omp-bridge/src/rpc.ts` + emulador | `pnpm test -- tests/omp-rpc.test.ts` | ready, negociación v2, host tool, resultado, settled y abort |
| F00-T04 | `packages/orchestrator/src/sqlite-spike.ts` | `pnpm test -- tests/langgraph-sqlite.test.ts` | interrupt persistido en SQLite y resume con grafo nuevo |
| F00-T05 | script de proceso real | `pnpm spike:omp:real` | versión/proceso real; puede quedar bloqueado si no hay modelo autenticado |

## Evidencia real observada

- `omp --version` respondió `omp/18.12.6` desde `/Users/luis/.local/bin/omp`.
- El proceso real RPC no llegó a emitir `ready`: terminó con el mensaje `No default model selected` y código 1 al ejecutar el smoke con perfil aislado. Esto es un bloqueo de entorno/auth, no se marca como compatibilidad RPC probada.
- El emulador JSONL cubre el contrato de transporte de forma determinista; no sustituye la prueba contra el binario real.
- No hay aplicación Electron ni superficie visual en Fase 00; no se fabrica captura. La evidencia de esta fase es textual/machine-readable.

## Límites

- `rpc-ui`, `set_host_tools` contra el binario real, captura visual y formato real de `tool_execution_end.details` quedan sin validar hasta disponer de un modelo/configuración OMP autorizada.
- El checkpointer SQLite se valida con `@langchain/langgraph-checkpoint-sqlite@1.1.0` y `better-sqlite3` local; no se declara compatibilidad con otra versión.
