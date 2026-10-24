# Gates de implementación

## GATE-00

Entrada: repositorio inspeccionado, stack fijado y ningún trabajo de Fase 01 iniciado.

Salida requerida: contratos, spikes OMP/LangGraph SQLite, ADRs y dossier. Decisión humana explícita.

## GATE-01

Entrada: `GATE-00: APPROVED` y Fase 01 como única fase activa.

Salida requerida:

- Shell Electron/React arranca desde `pnpm desktop`.
- Navegación funcional entre Resumen, ProductShape, Arquitectura, Evidencia y Cambios.
- Tabs de vista y selector de proyecto demo funcionales.
- Tema oscuro/claro y menú nativo Electron.
- Chat local demo con selección de contexto visible; no se presenta como OMP real.
- Panel lateral y chat tienen `resize` horizontal.
- Smoke Playwright real con dos capturas PNG.
- `STATUS.md` en `WAITING_USER_APPROVAL`.

Decisión humana: `APPROVED`, `CHANGES_REQUESTED` o `REJECTED`. El silencio no aprueba.
