# F07-T13 — Promoción de candidatos OMP a grafo ProductShape

Smoke determinista con Electron y ProductShape CLI `0.23.0`; OMP desactivado mediante `PROJECTSTUDIO_SKIP_BOOTSTRAP=1`.

Flujo ejecutado:

1. Crear un repositorio temporal e inicializar ProductShape.
2. Invocar el bridge real `studio:project:pdac-promote` con candidatos de actor, caso de uso y término de dominio.
3. Generar los drafts en `docs/product/model/`.
4. Ejecutar `prodshape graph --format json`.
5. Comprobar el grafo canónico.
6. Cerrar/reabrir Electron y volver a leer el grafo desde el proyecto.
7. Abrir la página Actores y capturar el canvas.

Resultado:

```json
{
  "ok": true,
  "created": 5,
  "nodeCount": 5,
  "types": ["actor", "bounded-context", "domain-term", "use-case"]
}
```

El actor `Learner` y el fallback de pruebas `Product user` aparecen en el canvas tras reabrir la aplicación. Captura: `F07-T13-pdac-promotion.png`.
