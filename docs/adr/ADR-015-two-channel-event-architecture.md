# ADR-015: arquitectura de dos canales

- Estado: aceptada como contrato inicial
- Fecha: 2026-10-24

## Decisión

Separar:

1. **Canal de control:** comando de usuario → LangGraph → adaptador OMP → gate/reintento/resultado.
2. **Canal de presentación:** eventos OMP/parsers → normalización/procedencia → eventos de actividad/artefacto/revisión para la UI.

Cada evento futuro debe conservar `projectId`, `threadId`, `runId`, `scopeId`, `taskId`, `eventId`, `sequence`, `revision` y timestamp según PRD §21.2. El renderer no esperará el cierre de `graph.invoke()` para mostrar hallazgos parciales.

## Evidencia Fase 00

`StudioEnvelopeSchema` exige identidad de proyecto, correlación, secuencia, origen y payload separado. No existe todavía Event Store ni renderer: son trabajo posterior y no se simulan aquí.

## Riesgo

La publicación durable y la recuperación de cursores requieren SQLite/Event Store de fases posteriores.
