# PDAC workbench

## Sub-features

- Barra de focos con contadores.
- Pantalla específica por artefacto.
- Timer de personalidad con selección anunciada.
- Canvas Tldraw offline y recuperación visual.
- Persistencia de edición hacia `.product/generated/product-graph.json`.

## Cómo llegar desde el usuario

1. Abrir un proyecto local.
2. Entrar en `ProductShape`.
3. Seleccionar `Actores`, `Casos de uso`, `Dominio`, `Journeys`, `Reglas`, `Requisitos` o `Bounded contexts`.
4. Revisar únicamente el diagrama del foco actual.
5. Aprobar o corregir desde el chat; el chat contiene explicación, el centro contiene el modelo visual.

## Verificación sin app

```bash
PROJECTSTUDIO_PROJECT_ROOT=/ruta pnpm verify:pdac:static
```

Debe comprobar schema, tipos, IDs, relaciones, evidencia y ausencia de objetivos transitorios en el grafo.

## Verificación DOM mínima cuando sea necesaria

- El botón del foco tiene `aria-label` y `title` con contador.
- El foco seleccionado tiene `aria-pressed="true"`.
- `.pdac-tldraw-stage` existe y no está vacío.
- `[data-chat-status="settled"]` aparece después de la respuesta OMP.
- Durante proactividad, `[data-personality-status="working"]` tiene `data-proactive-target`, el chat contiene `Sigo con ...` y los botones de `[aria-label="Objetivos sugeridos"]` están deshabilitados.
- Tras editar, leer el JSON del grafo; no validar sólo el pixel.

## Gotchas

- El grafo persistido es la verdad; no crear actores a partir de texto de proceso del asistente.
- En una pantalla de foco no mostrar la lista larga de objetivos (`Objetivo actual`, `Hallazgo publicado`, etc.); esa información pertenece al resumen/chat.
- Tldraw puede tener shapes en el store sin shapes DOM durante el montaje; la recuperación debe ser visible y editable, pero el E2E debe esperar la superficie estable antes de afirmar éxito.
- No usar `waitForTimeout` como criterio de asentamiento.
