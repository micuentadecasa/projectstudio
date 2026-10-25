# ADR-027: cierre explícito de la respuesta OMP hacia el renderer

- **Estado:** aceptado
- **Fecha:** 2026-03-10
- **Contexto:** Fase 07, flujo brownfield de Notes vacío

## Problema

OMP RPC sí entregaba `text_delta` al adapter y el worker aislado acumulaba una respuesta real, pero la UI podía acabar con `candidates=0` y `textLength=0`. El renderer ejecutaba la promoción al recibir `message_end`; ese camino llamaba a `window.studio.project.saveAnalysis`, aunque el preload no exponía ese método. La excepción interrumpía el listener antes de terminar la sesión y dejaba invisible la respuesta.

## Decisión

1. Centralizar la extracción de texto de frames OMP en `packages/orchestrator/src/omp-frame-text.ts`.
2. Hacer que el worker publique sólo deltas de texto visibles, no `thinking` ni `toolcall`, y que publique un `message_end` sintético siempre al recibir `session_settled`, incluso si el texto final viene vacío. El límite de sesión es explícito y ordenado.
3. Exponer `studio:project:analysis:save` en `preload.cjs` y su contrato TypeScript, alineado con el handler IPC existente.
4. Mantener en el renderer un fallback que vacía el texto acumulado en `session_settled`; así no se pierde una respuesta si el proveedor no emite un frame final con texto.
5. Cubrir la normalización pura con tests Vitest y el seam completo con `tests/e2e/notes-brownfield.ts` usando OMP real y ProductShape real.

## Consecuencias

- El chat recibe una frontera final determinista aunque el proveedor use `message_end` con otra forma de payload.
- El renderer puede guardar el informe antes de extraer y promover candidatos PDAC.
- Los frames internos de OMP siguen fuera del chat del usuario.
- Se mantiene la dependencia de OMP instalado y autenticado; no se añade un proveedor simulado.
- El E2E de Notes es una prueba de integración lenta y usa tokens reales; la extracción de frames dispone además de una prueba local sin Electron.

## Evidencia

- `pnpm exec tsx tests/e2e/notes-brownfield.ts`: pass; Notes vacío produjo deltas visibles, candidatos no cero y nodos `docs/product/model/` persistidos.
- `pnpm vitest run tests/omp-frame-text.test.ts tests/chat-events.test.ts`: 4 tests pass.
- `pnpm build:all`, `pnpm typecheck`, `pnpm typecheck:desktop` y `pnpm lint`: pass.
