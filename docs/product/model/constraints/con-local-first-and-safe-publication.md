# Restricción — local-first y publicación gobernada

## Local-first

La aplicación debe poder gestionar referencias, señales y resultados locales sin convertir el repositorio analizado en el almacenamiento interno de ProjectStudio.

## Publicación gobernada

El agente no decide por sí solo qué se publica como modelo aceptado. La aplicación debe conservar la diferencia entre:

- informe de una ejecución;
- vista provisional;
- baseline aceptado;
- propuesta futura.

## No efectos externos durante descubrimiento

El descubrimiento brownfield sólo inspecciona y documenta. No debe borrar archivos, modificar el repositorio, desplegar infraestructura ni convertir una respuesta textual en HTML o código ejecutable.

## Estado de implementación

El registro y el archivado reversible están implementados. El broker de permisos real, los worktrees y los side effects gobernados siguen fuera del alcance implementado descrito en `docs/implementation/STATUS.md:275-281`.

## Evidencia

- `docs/PRD.md:73-94`.
- `docs/adr/ADR-024-project-registry-and-brownfield-resume.md:8-29`.
- `apps/desktop/src/main.ts:221-238,393-429`.
- `packages/orchestrator/src/agent-runtime.ts:58-76`.
