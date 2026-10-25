# F07-T14 — Notes: grafo PDAC canónico recuperado

Fecha: 2026-03-06
Proyecto: `/Users/luis/projects/notes`
Modo: recuperación autónoma de pruebas; los nodos quedan como `draft` para revisión humana.

## Cadena verificable

1. OMP real produjo la evidencia ProductShape de Notes en `F05-T01-notes-productshape-real.md`.
2. La respuesta real contenía candidatos PDAC estructurados y evidencia de producto/código; el renderer los recibió con texto observable.
3. ProjectStudio normalizó esos candidatos y llamó al CLI real `@prodshape/cli@0.23.0` mediante `prodshape graph --format json`.
4. ProductShape persistió los drafts en `docs/product/model/` y recompiló `.product/generated/product-graph.json`.
5. `verify:pdac:static -- --expect-brownfield` validó IDs únicos, referencias, rutas de evidencia, ausencia de texto transitorio y los ocho tipos PDAC.
6. `test:e2e:notes:diagram` cerró y reabrió Electron sin tokens, comprobó la hidratación desde el grafo del proyecto, recorrió Casos de uso, Actores y Dominio, y capturó el lienzo.

## Resultado del grafo

| Tipo | Nodos |
|---|---:|
| actor | 3 |
| use-case | 7 |
| domain-term | 14 |
| journey | 3 |
| business-rule | 6 |
| constraint | 5 |
| functional-requirement | 4 |
| bounded-context | 5 |
| **Total** | **47** |

Grafo recompilado: 47 nodos, 31 relaciones y 0 nodos `canvas.md` contados como modelo canónico.

## Evidencia visual

- `F05-T06-notes-actors-tldraw.png`: lienzo de Actores tras reapertura.
- `F05-T06-notes-stored-diagram.png`: lienzo ProductShape persistido.
- `F05-T06-notes-stored-diagram.md`: texto DOM observado durante la prueba.

La prueba autónoma que inicia una copia temporal de Notes sin `docs/product/` ni `.product/` ya pasa con OMP real: el renderer recibe deltas y texto final, extrae candidatos y ProductShape persiste el grafo. El modo normal no activa recuperación autónoma ni resuelve ambigüedades sin el usuario.
