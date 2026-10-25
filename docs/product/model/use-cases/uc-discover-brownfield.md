# Caso de uso — descubrir un proyecto brownfield

## Objetivo

Obtener una primera comprensión trazable de un repositorio existente empezando por su documentación de producto disponible y contrastándola después con el código.

## Actor principal

[`act-project-user.md`](../actors/act-project-user.md).

## Precondiciones

- existe una referencia local a un proyecto;
- el proyecto no se clasifica como carpeta vacía;
- OMP está disponible, autenticado y con un modelo configurado para una ejecución real.

## Flujo principal

1. ProjectStudio detecta señales del proyecto.
2. El usuario inicia `Entender el proyecto` o una revisión equivalente.
3. El workflow inicia la inspección sin modificar archivos.
4. La aplicación muestra progreso resumido.
5. El resultado separa hechos, inferencias e incógnitas y conserva rutas de evidencia cuando existen.
6. La aplicación publica un mapa provisional o guardado.
7. El usuario decide si profundiza un foco PDAC o solicita documentación de arquitectura.

## Resultado

El usuario dispone de un informe y, si existe, un diagrama recuperable en la superficie central. El resultado sigue siendo provisional hasta revisión humana.

## Errores y límites

- Si el proceso no puede iniciarse, la UI muestra un error accionable.
- Si el descubrimiento queda interrumpido, puede marcarse como reanudable.
- Un resultado tardío no debe publicarse en otro proyecto.
- El caso de uso no autoriza modificaciones del repositorio.

## Evidencia

- `apps/desktop/src/main.ts:393-429` inicia el descubrimiento.
- `apps/desktop/src/renderer/main.tsx:308-429` muestra progreso y resultado.
- `docs/implementation/JOURNEY-BROWNFIELD.md:19-28,50-58` define el recorrido y sus reglas.
