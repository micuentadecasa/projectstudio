# ADR-014: LangGraph.js frente a LangGraph Python

- Estado: aceptada para Fase 00
- Fecha: 2026-10-24
- Alcance: plano de control de ProjectStudio

## Contexto

La UI objetivo es Electron/React y el PRD §21 exige LangGraph.js fuera del renderer para estado, routing, checkpoints e interrupciones. Python añadiría otro runtime en el primer corte.

## Decisión

Usar `@langchain/langgraph@1.5.2` en TypeScript/Node. Usar `@langchain/langgraph-checkpoint-sqlite@1.1.0` como adaptador SQLite inicial. El agente OMP sigue siendo un proceso separado; LangGraph no reimplementa el agente.

## Evidencia Fase 00

`tests/langgraph-sqlite.test.ts` y `pnpm spike:langgraph` suspenden con `interrupt()`, persisten el checkpoint en SQLite, reconstruyen el grafo/checkpointer y reanudan con `Command({ resume })`.

## Consecuencias

- Un runtime y contratos TypeScript para Electron Main/orquestador.
- Native `better-sqlite3` debe compilarse en el entorno.
- La semántica de side effects/idempotencia aún necesita el workflow de Fase 02; este ADR no declara esa capacidad implementada.
