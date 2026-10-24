# Fase 03 — dossier de evidencia

## Objetivo

Añadir el adaptador OMP RPC aislado: negociación v2, streaming, host tools, `steer`/`follow_up`, abort, sesión lógica y warnings de transporte.

## Tareas

| ID | Estado | Output | Verificación |
|---|---|---|---|
| F03-T01 | done | `packages/omp-bridge/src/omp-adapter.ts` | interfaz única OMP con estados y eventos tipados |
| F03-T02 | done | `packages/omp-bridge/src/rpc.ts` | correlación request/response sin race y decoder chunk v2 |
| F03-T03 | done | `tests/omp-adapter.test.ts` | ready/v2, streaming, host tool, follow_up, steer y abort |
| F03-T04 | done | `scripts/run-omp-adapter-spike.ts` | emulador y probe binario real |
| F03-T05 | done | `STATUS.md`, `PHASE-GATES.md` | gate y límites reales documentados |

## Smoke emulado observado

```bash
pnpm spike:omp-adapter
```

Resultado: `status=settled`, `protocolVersion=2`, con eventos `ready`, `message_update`, `host_tool_call`, `prompt_result` y `session_settled`.

## Probe real observado

```bash
pnpm spike:omp-adapter --real
```

Resultado real: `status=blocked`. El binario `omp/18.12.6` termina antes de `ready` porque el perfil aislado no tiene modelo:

```text
No default model selected.
Use /login, set an API key environment variable, or select a local model with /model.
```

No se añadió ninguna credencial ni se marcó el transporte real como PASS. El emulador cubre el protocolo de forma determinista; no sustituye al proceso real.

## Tests

```bash
pnpm test:f03
```

Cubre:

- negociación RPC v2;
- consulta de estado, modelos y comandos al arrancar;
- registro de host tool y respuesta `host_tool_result`;
- `message_update`, `prompt_result` y `session_settled`;
- `follow_up` y `steer` durante streaming;
- abort y cierre sin error no controlado;
- session key lógica y estados del adaptador.

## Limitaciones

- El proveedor/modelo real OMP sigue bloqueado por configuración local.
- La persistencia física del transcript la gestiona OMP mediante `profile`/`session-dir`; la persistencia lógica de ProjectStudio queda para integración posterior.
- No se conectó todavía el chat React al adaptador; la UI sigue demo local hasta completar la ruta de control de la siguiente integración.
- No hay nueva captura: esta fase no cambia la superficie visual.
