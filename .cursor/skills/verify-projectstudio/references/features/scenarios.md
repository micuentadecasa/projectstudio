# Escenarios PDAC

## Sub-features

- Greenfield vacío: entrevista del primer caso de uso.
- Brownfield con ProductShape existente: carga de verdad persistida.
- Modificación humana: edición de una entidad y relación.
- Reanudación: cerrar y abrir conserva proyecto, foco y grafo.

## Cómo se verifica

### Sin app

```bash
pnpm verify:pdac:scenarios
PROJECTSTUDIO_PROJECT_ROOT=/Users/luis/projects/notes pnpm verify:pdac:static -- --expect-brownfield
```

Esta capa valida la matriz y el estado de filesystem sin tokens ni OMP.
Para un foco con modelo ProductShape, la UI intenta antes `prodshape graph --format json`; si devuelve un grafo vacío, la comprobación semántica vuelve a OMP.

### Con OMP, sólo cuando el comportamiento lo exige

Usar el E2E mínimo del escenario. Esperar eventos observables (`message-row.omp`, `data-chat-status=settled`) y comprobar el grafo después de cada modificación. La matriz de 20 escenarios se reserva para cambios transversales y no para cada ajuste visual.

## Cobertura

Cada escenario debe tener prompt inicial, modificación, tipo (`greenfield`/`brownfield`) y slug único. La matriz actual exige 10 de cada tipo. Los proyectos temporales se eliminan al finalizar; nunca se toca `/Users/luis/projects/notes` durante la matriz.

## Gotchas

- Una respuesta del LLM no demuestra que el grafo se actualizó.
- Un screenshot del canvas no demuestra que los actores sean entidades PDAC.
- Un test DOM sin lectura posterior del JSON no demuestra persistencia.
- El timer no debe inventar actores: sólo debe continuar el siguiente foco respaldado por evidencia o hacer una pregunta concreta.
