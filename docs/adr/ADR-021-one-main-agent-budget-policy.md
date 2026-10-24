# ADR-021: un agente principal y presupuesto

- Estado: aceptada
- Fecha: 2026-10-24

## Decisión

ProjectStudio usa un único agente OMP principal por sesión lógica. No se habilitan subagentes por defecto. El host limita tokens, artefactos, tiempo y herramientas según modo/proyecto; los parsers deterministas no cuentan como agentes.

## Razón

Reduce cruces de contexto, gasto, superficies de permiso y recuperación ambigua. LangGraph coordina workflows; no crea automáticamente otro agente.

## Evidencia Fase 00

`.omp/RULES.md` y `.omp/skills/` lo fijan como regla. No se ha iniciado ninguna sesión OMP con subagentes.
