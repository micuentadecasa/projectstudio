---
name: verify-projectstudio
description: "Verificación determinista de ProjectStudio y PDAC: contratos estáticos, grafos, escenarios y pruebas DOM sólo cuando aportan valor."
disable-model-invocation: true
---

# Verify ProjectStudio

La primera capa NO lanza Electron ni consume OMP. Comprueba la fuente PDAC, los contratos de escenarios y la compilación TypeScript. Sólo la segunda capa lanza la app cuando el comportamiento depende del DOM real, Tldraw, IPC o RPC.

## Orden obligatorio

1. `pnpm verify:pdac:scenarios`: valida la matriz de escenarios sin crear carpetas ni abrir Electron.
2. `PROJECTSTUDIO_PROJECT_ROOT=/ruta pnpm verify:pdac:static`: valida el grafo, referencias de evidencia, tipos PDAC, relaciones y ausencia de texto transitorio.
3. `pnpm verify:ui:static`: valida los contratos de estado, selección de foco, canvas filtrado, anuncio del timer y bloqueo de botones leyendo el renderer; no lanza Electron.
4. `pnpm typecheck && pnpm typecheck:desktop && pnpm lint`: verifica contratos TypeScript sin runtime.
5. Sólo si el cambio toca DOM real, Tldraw, persistencia IPC o OMP: ejecutar el E2E mínimo del feature; no repetir la matriz completa.
## Prueba de Notes sin PDAC persistido

```bash
PROJECTSTUDIO_PROJECT_ROOT=/Users/luis/projects/notes pnpm verify:pdac:static -- --expect-brownfield
```

Resultado válido para Notes: no existe `.product/generated/product-graph.json` ni `docs/product/`, pero el proyecto conserva código visible y por tanto es Brownfield sin modelo PDAC. No se inventan actores ni casos de uso.

## Prueba de Brownfield

```bash
PROJECTSTUDIO_PROJECT_ROOT=/ruta/al/proyecto pnpm verify:pdac:static -- --expect-brownfield
```

Resultado válido: grafo PDAC válido, nodos con IDs únicos, relaciones con extremos existentes, rutas de evidencia existentes y cobertura mínima de actores, casos de uso, journeys, dominio, reglas, requisitos y bounded contexts.

## Cuándo usar OMP y cuándo no

- No usar OMP para validar conteos, schema, rutas, IDs, relaciones, clasificación Greenfield/Brownfield, selección del foco ni ausencia de prompts internos.
- Usar OMP sólo para validar que una petición real descubre o modifica evidencia que no puede derivarse determinísticamente.
- No usar capturas como única prueba: cada captura debe acompañarse de una aserción DOM y, cuando haya side effect, lectura del grafo.
- Para streaming, esperar `message-row.omp` nuevo y `[data-chat-status="settled"]`; nunca usar sleeps fijos como condición de éxito.

## Evidencia mínima por foco

Para cada foco PDAC: título visible, contador, canvas no vacío, foco seleccionado y grafo actualizado. Para Actores, la prueba debe demostrar que el canvas contiene sólo actores; el panel de texto largo pertenece al resumen y no debe aparecer en la pantalla de foco.

## Mapa de features

- `references/features/README.md`: orden de barrido.
- `references/features/pdac-workbench.md`: navegación PDAC, timer, canvas y persistencia.
- `references/features/scenarios.md`: escenarios Greenfield/Brownfield y qué capa verifica cada paso.
