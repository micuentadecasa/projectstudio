# F07-T12 — ProductShape CLI antes de OMP

Fecha de ejecución: smoke runtime local.

Fixture temporal: `/tmp/projectstudio-psfixture`, con ProductShape `0.23.0`, un actor real `Learner` y un grafo generado por `prodshape graph --format json`.

Comprobaciones:

- Electron abrió la superficie ProductShape sin pantalla negra.
- La página `Actores` mostró un hallazgo y el canvas tldraw con `Actor: Learner`.
- `Actualizar actores` ejecutó el handler `studio:project:productshape-graph`.
- El chat publicó `He actualizado actores desde ProductShape...`.
- El número de mensajes OMP pasó de 1 a 2 únicamente por el mensaje de confirmación de ProjectStudio; no se realizó una segunda llamada OMP.
- El grafo persistido conservó un nodo `actor` titulado `Learner`.

Captura: `F07-T12-productshape-cli-focus.png`.

Fallback comprobado por código: si ProductShape no tiene modelo o devuelve un grafo vacío, ProjectStudio elimina la salida vacía regenerable y delega el descubrimiento semántico a OMP. En `/Users/luis/projects/notes` ese es el estado actual porque se retiraron `docs/product/` y `.product/` para reiniciar el descubrimiento.
