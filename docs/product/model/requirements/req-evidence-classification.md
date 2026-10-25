# Requisito — clasificación y procedencia de hallazgos

## Enunciado

Todo resultado de descubrimiento visible debe distinguir, como mínimo:

- **Hecho:** afirmación respaldada directamente por una fuente verificable.
- **Inferencia:** interpretación derivada de hechos y todavía sujeta a revisión.
- **Pendiente:** cuestión que la evidencia disponible no resuelve.

Cada hallazgo debe conservar una ruta, referencia o indicación explícita de ausencia de evidencia.

## Criterios observables

- el resumen muestra contadores separados por tipo;
- cada fila de hallazgo muestra la etiqueta de clasificación;
- la vista central conserva el contexto del proyecto activo;
- una respuesta provisional no se presenta como baseline aceptado;
- la persona puede revisar el resultado antes de promoverlo.

## Estado

La UI actual cumple la presentación de estas categorías a partir del informe recibido. La persistencia semántica de hallazgos como entidades independientes todavía no está demostrada.

## Evidencia

- `apps/desktop/src/renderer/main.tsx:466-514` calcula filtros y contadores.
- `apps/desktop/src/renderer/main.tsx:732-743` presenta las categorías y rutas.
- `apps/desktop/src/main.ts:350-368` persiste el informe agregado, no un registro de hallazgos tipado.
- `CONTEXT.md:7-19` define los términos canónicos.
