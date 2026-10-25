# ADR-026 — Greenfield PDAC guiado y revisión proactiva acotada

- **Estado:** aceptado para el slice F06
- **Fecha:** 2026-02-20
- **Contexto:** el mismo asistente debe ayudar a documentar repositorios brownfield y a iniciar un producto sin código. La conversación visible no debe exponer prompts ni detalles RPC. La personalidad actual estaba limitada a un prefijo del prompt por invocación; no existía un repaso temporal.

## Decisión

1. La detección de proyecto clasifica una carpeta sin entradas visibles, salvo dotfiles y `node_modules`, como `greenfield`. El registro local persiste `mode` y las señales detectadas; archivar sigue siendo soft-delete.
2. ProductShape cambia su orientación según el modo:
   - Brownfield: revisión de evidencia existente, sin inventar PDAC.
   - Greenfield: entrevista de un caso de uso, una decisión por pregunta, con borrador PDAC provisional antes de arquitectura.
3. El centro de ProductShape usa una barra de iconos con contador para las entidades PDAC y una única línea de actividad. El chat conserva la conversación humana; la UI central sólo muestra progreso, hallazgos y el trabajo visual.
4. La interfaz separa dos superficies:
   - **dinámica**: foco actual, spinner OMP, actividad resumida, diagrama provisional y acción de actualización;
   - **estática**: evidencia guardada, hallazgos clasificados y glosario del dominio debajo del mapa.
   El foco actual puede ocupar toda la pantalla; el estado general sigue disponible con `Estado general`.
5. Las entidades navegables son Propósito, Actores, Casos de uso, Dominio, Journeys, Reglas, Requisitos y Bounded contexts. Cada página filtra hallazgos y permite solicitar una profundización contextual a OMP. Dominio añade un glosario de términos con descripción y evidencia.
6. Cada página de entidad muestra un lienzo tldraw local y editable. Se inicializa con los títulos de los hallazgos actuales, usa una `persistenceKey` por proyecto y entidad, y guarda el trabajo en IndexedDB del dispositivo. El mapa SVG/Graphviz permanece como vista general; el lienzo es el espacio de edición manual de actores, journeys, dominio y demás artefactos.
7. Si el proyecto contiene `.product/generated/product-graph.json`, ese grafo PDAC es la fuente de verdad al reabrir. ProjectStudio reconstruye el inventario y el mapa a partir de sus nodos/relaciones; el resumen `.tmp/project-analysis` sólo es fallback cuando el proyecto no publica un grafo PDAC.
8. El Arquitecto de Proyecto recibe instrucciones de personalidad, trazabilidad y revisión. Su contrato es mantener un objetivo actual, no repetir preguntas resueltas, trabajar sólo el foco solicitado y cerrar con una siguiente decisión. En brownfield, el renderer inicia una revisión proactiva sólo con hallazgos previos, tras 15 minutos sin interacción y como máximo una vez por intervalo. Greenfield queda fuera del timer para no interrumpir la entrevista.

## Consecuencias

- Una carpeta vacía ya tiene una siguiente acción visible y no presenta opciones de arquitectura sin PDAC.
- Los diagramas y hallazgos pueden aparecer antes de que termine la respuesta, pero siguen marcados como provisionales hasta recibir evidencia completa.
- El timer puede consumir una llamada OMP real en sesiones brownfield largas; por eso exige inactividad, hallazgos previos y no ejecución concurrente.
- El modo sólo clasifica el proyecto; no modifica la carpeta local ni crea ProductShape automáticamente.

## Rechazado

- Simular OMP para Greenfield.
- Presentar el prompt de entrevista en el chat.
- Activar una revisión periódica durante Greenfield o mientras hay una tarea en curso.
- Convertir inferencias del agente en un modelo PDAC canónico sin confirmación.
