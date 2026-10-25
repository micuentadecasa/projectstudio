# Caso de uso — registrar y reanudar un proyecto

## Objetivo

Abrir, cambiar o archivar una referencia local sin borrar ni modificar el repositorio analizado.

## Flujo principal

1. ProjectStudio calcula un identificador derivado de la ruta.
2. Registra nombre, ruta, modo, señales detectadas y fecha de apertura.
3. Al cambiar de proyecto, actualiza el `cwd` del worker y reinicia su contexto de ejecución.
4. Al archivar, marca la referencia como archivada.
5. Al seleccionar una referencia archivada, la reactiva y vuelve a detectar sus señales.

## Persistencia

- Registro: `.tmp/projectstudio-projects.json`.
- Estado de análisis: `.tmp/project-analysis/<projectKey>.json` cuando no existe un grafo PDAC del proyecto.
- Grafo PDAC del proyecto: `.product/generated/product-graph.json` si el repositorio analizado lo proporciona.

## Invariantes

- Archivar no borra la ruta.
- El repositorio analizado no es el almacén del registro local.
- La detección de carpetas es una señal, no una validación semántica del contenido.

## Evidencia

- `apps/desktop/src/main.ts:128-212,221-238`.
- `apps/desktop/src/main.ts:255-368`.
- `docs/adr/ADR-024-project-registry-and-brownfield-resume.md:11-29`.
