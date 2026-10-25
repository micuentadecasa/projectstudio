# Mapa de verificación ProjectStudio

## Precondiciones deterministas

- `pnpm verify:pdac:scenarios` no lanza la app.
- `PROJECTSTUDIO_PROJECT_ROOT=/ruta pnpm verify:pdac:static` no lanza la app.
- `pnpm typecheck && pnpm typecheck:desktop && pnpm lint` no requiere OMP.
- Los tests que llamen a OMP deben declarar `mode: real-omp` y guardar el resultado; no cuentan como verificación de UI estática.

## Orden de barrido

1. `pdac-workbench.md`: estado, foco, navegación y canvas.
2. `scenarios.md`: Greenfield, Brownfield, reanudación y modificaciones.
3. E2E mínimo del cambio: sólo si el contrato no puede verificarse leyendo grafo, filesystem o compilación.

## Regla de prueba

Cada caso debe registrar:

- precondición;
- acción del usuario;
- estado observable estable;
- side effect comprobable;
- bloqueo o limitación real.

Un screenshot sin una aserción de estado no es evidencia suficiente.
