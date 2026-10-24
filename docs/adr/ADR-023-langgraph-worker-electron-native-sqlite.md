# ADR-023 — Ejecutar LangGraph SQLite en worker Node separado

- **Estado:** aceptado
- **Fecha:** 2026-10-24

## Contexto

`@langchain/langgraph-checkpoint-sqlite` usa `better-sqlite3`. Electron y el Node usado por pnpm pueden tener ABI distintos; cargar el módulo nativo dentro del proceso Electron hace que la UI falle aunque los tests Node pasen. El renderer tampoco debe contener el orquestador.

## Decisión

El proceso principal Electron mantiene la ventana y el broker IPC. `AgentWorkerRuntime` lanza un worker Node (`packages/orchestrator/src/agent-worker.ts`) que hospeda `StudioAgentRuntime`, su SQLite y el `OmpAdapter` real. El worker usa JSONL local:

- `chat_start`: main → worker para iniciar la sesión OMP real;
- `start`: main → worker con workflow, prompt interno y contexto;
- `event`: worker → main con eventos de presentación resumidos;
- `result`: worker → main con estado del grafo.

El worker es el único propietario del proceso OMP durante una sesión. El renderer sólo recibe progreso resumido, mensajes finales y estado settled; no recibe prompts internos, argumentos de herramientas ni frames RPC.

## Consecuencias

- Se conserva LangGraph + SQLite durable sin exigir recompilar módulos nativos para Electron.
- El worker necesita cierre explícito y propagación de errores.
- El contrato JSONL del worker es interno y debe mantener IDs de request y thread.
- Una futura distribución empaquetada debe incluir un Node runtime compatible o configurar `PROJECTSTUDIO_NODE_BIN`.
