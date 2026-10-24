# Fase 02 — LangGraph persistente

## F02-T01 — StateGraph

Crear una sola interfaz `StudioGraphRuntime` detrás de la cual viven las rutas `navigate` e `inspection`.

## F02-T02 — SQLite y recuperación

Persistir checkpoints con `SqliteSaver`, conservar `threadId`/`runId` y reconstruir el runtime desde el mismo archivo.

## F02-T03 — Gates mock

Usar `interrupt()` para pausar inspecciones y `Command({ resume })` para decisiones `approved`/`rejected`. Registrar audit log sin duplicar la transición inicial.

## F02-T04 — Evidencia

Añadir tests, smoke JSON, documentación del gate y detenerse en `WAITING_USER_APPROVAL`. No integrar OMP real ni iniciar Fase 03.
