# ProductShape de ProjectStudio

## Estado

Fuente canónica del comportamiento de producto observado y aceptado para ProjectStudio. `docs/PRD.md` conserva la especificación integral y las decisiones de alcance; este directorio expresa el modelo de producto navegable y sus evidencias.

La documentación distingue tres niveles:

- **Aceptado:** comportamiento que el repositorio define y que el código actual implementa o expone de forma verificable.
- **Propuesto:** comportamiento descrito por el PRD y todavía no demostrado por el código actual.
- **Incógnita:** decisión que no puede resolverse con la evidencia disponible.

No se debe convertir automáticamente una inferencia del agente en un artefacto aceptado.

## Lectura recomendada

1. [`architecture.md`](./architecture.md): propósito, frontera y capacidades del producto.
2. [`model/actors/act-project-user.md`](./model/actors/act-project-user.md): actor operativo actual.
3. [`model/use-cases/uc-discover-brownfield.md`](./model/use-cases/uc-discover-brownfield.md): descubrimiento brownfield.
4. [`model/use-cases/uc-resume-project.md`](./model/use-cases/uc-resume-project.md): registro y reanudación.
5. [`model/requirements/req-evidence-classification.md`](./model/requirements/req-evidence-classification.md): clasificación de hallazgos.
6. [`model/constraints/con-local-first-and-safe-publication.md`](./model/constraints/con-local-first-and-safe-publication.md): límites de seguridad y publicación.
7. [`model/journeys/jrn-brownfield-discovery.md`](./model/journeys/jrn-brownfield-discovery.md): recorrido principal.
8. [`model/domain/bc-project-discovery.md`](./model/domain/bc-project-discovery.md): términos y frontera del contexto de descubrimiento.

## Evidencias principales

- `docs/PRD.md:21-40,73-94`: intención global y principios.
- `docs/implementation/JOURNEY-BROWNFIELD.md:7-28`: resultado y recorrido brownfield.
- `docs/implementation/STATUS.md:213-285`: estado de implementación, límites y próximos slices.
- `apps/desktop/src/main.ts:128-237,393-505`: registro, detección y arranque del descubrimiento.
- `apps/desktop/src/renderer/main.tsx:324-376,378-455,726-743`: recuperación, progreso, hallazgos y vistas PDAC.
- `packages/orchestrator/src/agent-runtime.ts:52-103`: personalidad y workflow del agente.

## Fuera de este modelo

- La arquitectura técnica detallada sigue en `docs/PRD.md` y los ADR de `docs/adr/`.
- La evidencia de proyectos externos, como Notes, permanece en `docs/implementation/evidence/` y no es evidencia de dominio de ProjectStudio.
- Este directorio no autoriza escrituras, cambios Git, despliegues ni acceso cloud.
