# ADR-018: checkpoints e idempotencia ante reinicios

- Estado: principio aceptado; alcance de Fase 00 limitado al spike
- Fecha: 2026-10-24

## Decisión

`thread_id` es el cursor persistente del grafo. Los side effects futuros llevarán `sideEffectId` durable y se comprobarán fuera del modelo antes de ejecutar. Reintentar un nodo debe recuperar el resultado ya registrado, no repetir commit/tool externa.

## Evidencia Fase 00

El spike SQLite pausa con `interrupt()`, conserva el estado y reanuda desde un grafo nuevo con el mismo `thread_id`. No ejecuta side effects externos; por tanto LG-02 y LG-04 siguen pendientes.

## Consecuencia

No se autoriza interpretar el éxito de `Command({ resume })` como permiso de escritura. El Permission Broker debe revalidar SHA, paths y riesgo justo antes del efecto.
