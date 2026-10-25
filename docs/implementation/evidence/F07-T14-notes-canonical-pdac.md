# F07-T14 — Notes: grafo PDAC canónico recuperado

Fecha: 2026-03-06
Proyecto: `/Users/luis/projects/notes`
Modo: recuperación autónoma de pruebas; los nodos quedan como `draft` para revisión humana.

## Cadena verificable

1. OMP real produjo la evidencia ProductShape de Notes en `F05-T01-notes-productshape-real.md`.
2. El bloque estructurado contenía 44 candidatos PDAC en ocho tipos.
3. ProjectStudio normalizó esos candidatos y llamó al CLI real `@prodshape/cli@0.23.0` mediante `prodshape graph --format json`.
4. ProductShape persistió los drafts en `docs/product/model/` y recompiló `.product/generated/product-graph.json`.
5. `verify:pdac:static -- --expect-brownfield` validó IDs únicos, referencias, rutas de evidencia, ausencia de texto transitorio y los ocho tipos PDAC.
6. `test:e2e:notes:diagram` cerró y reabrió Electron sin tokens, comprobó la hidración desde el grafo del proyecto, recorrió Casos de uso, Actores y Dominio, y capturó el lienzo.

## Resultado del grafo

| Tipo | Nodos |
|---|---:|
| actor | 7 |
| use-case | 9 |
| domain-term | 8 |
| journey | 2 |
| business-rule | 5 |
| constraint | 5 |
| functional-requirement | 3 |
| bounded-context | 7 |
| **Total** | **46** |

Grafo recompilado: 46 nodos, 24 relaciones, 0 nodos `canvas.md` contados como modelo canónico.

## Evidencia visual

- `F05-T06-notes-actors-tldraw.png`: lienzo de Actores tras reapertura.
- `F05-T06-notes-stored-diagram.png`: lienzo ProductShape persistido.
- `F05-T06-notes-stored-diagram.md`: texto DOM observado durante la prueba.

## Límite explícito

El test autónomo que inicia Notes vacío y espera que el renderer extraiga directamente la respuesta OMP sigue fallando en esta máquina con `candidates=0` y `textLength=0`; no se presenta como pass. La promoción desde la respuesta OMP real capturada sí está cubierta por el puente Electron/ProductShape y por `test:e2e:pdac:promotion`. El modo normal no activa recuperación autónoma ni resuelve ambigüedades sin el usuario.
