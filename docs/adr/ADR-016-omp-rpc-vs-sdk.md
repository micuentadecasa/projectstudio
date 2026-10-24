# ADR-016: OMP RPC frente a SDK

- Estado: RPC seleccionado para el primer adaptador; SDK diferido
- Fecha: 2026-10-24

## Contexto

El PRD exige el repositorio `can1357/oh-my-pi`, proceso aislado y RPC JSONL no-JSON-RPC. La documentación upstream indica que RPC es la superficie para aislamiento entre procesos y SDK requiere Bun.

## Decisión

Primera implementación: `omp --mode rpc` como child process, con negociación v2, correlación por ID y decoder de `rpc_chunk`. No mezclar RPC y SDK en una sesión. SDK queda como alternativa de spike futuro.

## Evidencia real

- Binario local: `omp/18.12.6`, `/Users/luis/.local/bin/omp`.
- El probe real fue bloqueado antes de `ready` por `No default model selected`, código 1, usando perfil aislado y sin credenciales nuevas.
- El emulador cubre `ready`, negociación v2, `host_tool_call/result`, `prompt_result`, `session_settled` y `abort`; no sustituye al proceso real.

## Consecuencia

La compatibilidad funcional OMP queda `BLOCKED` hasta disponer de un modelo/configuración autorizada. No se afirma soporte de `rpc-ui` ni de `set_host_tools` real.
