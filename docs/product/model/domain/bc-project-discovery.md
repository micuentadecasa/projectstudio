# Bounded context — Project Discovery

## Frontera

Este contexto reúne la referencia a un proyecto, la detección de señales documentales, los hallazgos del descubrimiento y las vistas que los presentan. No representa todavía el dominio funcional del repositorio analizado.

## Términos

- **Proyecto:** referencia local a una carpeta autorizada, con nombre, ruta, modo y señales.
- **Descubrimiento:** ejecución que inspecciona documentación y código para producir un informe trazable.
- **Hallazgo:** unidad visible clasificada como hecho, inferencia o pendiente.
- **Vista:** proyección de un informe o diagrama para revisión humana.
- **Baseline:** modelo aceptado que todavía no se materializa como fuente semántica durable en este repositorio.

## Relaciones confirmadas

- Un proyecto puede tener cero o más ejecuciones de descubrimiento.
- Una ejecución produce un informe y puede producir un mapa.
- Un informe puede contener varios hallazgos.
- Una vista puede mostrar hallazgos de un único proyecto activo.

## Incógnitas

- Identidad persistente de cada hallazgo fuera del informe agregado.
- Esquema definitivo del modelo PDAC aceptado.
- Relación durable entre hallazgo, snapshot, commit y evidencia.

## Evidencia

- `apps/desktop/src/main.ts:116-126,251-368`.
- `apps/desktop/src/renderer/main.tsx:274-306,466-514`.
- `packages/contracts/src/index.ts:106-143`.
