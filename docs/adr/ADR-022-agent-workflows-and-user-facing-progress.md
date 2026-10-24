# ADR-022 — Workflows de agentes y progreso orientado al usuario

- **Estado:** aceptado para el slice actual
- **Fecha:** 2026-10-24

## Contexto

ProjectStudio no debe convertir cada botón o texto del chat en una llamada directa a OMP. El PRD v3 exige que LangGraph sea el plano de control y que los eventos de OMP se publiquen por un canal de presentación separado. Además, los prompts, argumentos de herramientas, checkpoints y frames RPC son detalles de implementación: ayudan al diagnóstico, pero no son la experiencia del usuario.

## Decisión

1. La UI envía un `ProjectStudioCommand` al proceso principal.
2. `StudioAgentRuntime` resuelve el workflow en LangGraph y llama a OMP mediante `OmpPromptGateway` sólo desde el nodo `invoke_omp`.
3. El proceso principal conserva la sesión OMP y retransmite eventos de presentación.
4. La UI ignora deltas de texto internos mientras llegan; muestra actividad resumida y publica sólo la respuesta final y los artefactos reconocidos.
5. Los estados internos se traducen a estados de producto: `iniciando`, `trabajando`, `listo`, `requiere atención`.
6. Brownfield, documentación de arquitectura y planificación de arquitectura son workflows distintos; planificación siempre produce una propuesta aislada.

## Alternativas rechazadas

- **Renderer → OMP directamente:** mezcla presentación y control, hace imposible aplicar gates y deja prompts internos visibles.
- **Ocultar todo el progreso:** evita ruido, pero deja al usuario sin saber si el análisis sigue activo o se ha bloqueado.
- **Un único workflow genérico:** pierde la diferencia entre evidencia observada, documentación del baseline y propuesta de Architecture Lab.

## Consecuencias

- La UI queda desacoplada del transporte OMP y puede cambiar sin alterar el agente.
- El runtime de agentes necesita persistir `threadId`, `runId` y checkpoints; el gateway sigue siendo la única salida a OMP.
- El parser/publicador de artefactos deberá crecer para que los resultados no dependan del texto final.
- La respuesta final de OMP debe ser breve y orientada a decisiones; los detalles completos quedan en Evidence/Activity, no en el chat.
