# ADR-019: retención y clasificación de artefactos

- Estado: decisión inicial
- Fecha: 2026-10-24

## Decisión

Clasificar cada artefacto por proyecto, sesión, scope, procedencia y sensibilidad antes de persistirlo. SQLite conserva metadatos/eventos; blobs locales conservan recursos grandes; Git sólo recibe exportaciones sanitizadas deliberadas. Los snapshots temporales no son fuente canónica y su poda requiere un gate explícito y referencias protegidas.

## Fase 00

Sólo se documenta el contrato. No hay blob store, snapshots ni limpieza automática implementados.

## Riesgo

La cuota, TTL, redacción y borrado seguro deben definirse antes de habilitar imágenes, cloud o transcriptos extensos.
