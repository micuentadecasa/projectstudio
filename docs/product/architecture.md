# Frontera de producto — ProjectStudio

## Propósito

ProjectStudio es un workbench local-first para que una persona técnica o de producto pueda entender un repositorio existente, conservar hallazgos trazables y documentar su arquitectura sin tratar las respuestas del agente como fuente de verdad automática.

La experiencia actual combina un selector de proyectos, una superficie central de ProductShape, un chat con el Arquitecto de Proyecto y vistas de evidencia. El agente ayuda a investigar y resumir; la aplicación controla el proyecto activo y la publicación de resultados.

**Evidencia:** `docs/PRD.md:21-40`, `CONTEXT.md:1-19`, `apps/desktop/src/renderer/main.tsx:119-134`.

## Frontera actual

Dentro de la frontera:

- registrar y cambiar referencias a proyectos locales;
- detectar señales de `docs/product`, arquitectura y proyectos vacíos;
- iniciar un descubrimiento brownfield;
- mostrar progreso resumido y hallazgos clasificados como hechos, inferencias o pendientes;
- mostrar un diagrama provisional o guardado derivado de Mermaid;
- conservar informes y diagramas en el almacenamiento local de ProjectStudio;
- abrir páginas PDAC y lienzos locales por entidad;
- reanudar una referencia archivada sin borrar el repositorio.

Fuera de la frontera implementada actualmente:

- convertir automáticamente hallazgos en ProductShape aceptado;
- un modelo C4 semántico durable como fuente primaria del diagrama;
- Permission Broker real para side effects externos;
- edición Git/worktrees y aprobación de cambios de código;
- inspección cloud operativa;
- publicación de artefactos visuales durables mediante un Event Store completo.

**Evidencia de límites:** `docs/implementation/STATUS.md:275-285`, `apps/desktop/src/main.ts:255-368`, `apps/desktop/src/renderer/main.tsx:160-230`.

## Fuente de verdad y procedencia

1. El repositorio del proyecto conserva su documentación y código originales.
2. ProjectStudio conserva referencias, estado de análisis e historial local fuera del repositorio analizado.
3. Un informe recibido del agente es evidencia de una ejecución, no aceptación automática.
4. Un hallazgo sin ruta o referencia verificable queda como incógnita, no como hecho.
5. La arquitectura futura debe separar baseline aceptado de propuestas; el código actual sólo demuestra esa separación a nivel de intención y workflow.

**Evidencia:** `docs/adr/ADR-024-project-registry-and-brownfield-resume.md:8-29`, `packages/orchestrator/src/agent-runtime.ts:58-76`.
