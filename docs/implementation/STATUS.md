# ProjectStudio — estado de implementación

## Estado actual

```yaml
phase: '03'
state: WAITING_USER_APPROVAL
baselineCommit: 8abe2b4
branch: main
gate: GATE-03
userDecision: null
nextPhase: '04'
```

La instrucción del usuario «sigue creando» se toma como aprobación explícita de GATE-02. Fase 03 fue la única fase activa. Fase 04 no está iniciada.

## Fase 03 — tareas

| ID | Estado | Superficie | Output verificable |
|---|---|---|---|
| F03-T01 | done | transporte RPC | `packages/omp-bridge/src/rpc.ts`: JSONL, correlación y chunk decoder v2 |
| F03-T02 | done | adapter | `packages/omp-bridge/src/omp-adapter.ts`: estados, sesión y startup |
| F03-T03 | done | eventos | streaming, host tools, `steer`, `follow_up`, `abort`, settled |
| F03-T04 | done | tests/smoke | `tests/omp-adapter.test.ts`, `scripts/run-omp-adapter-spike.ts` |
| F03-T05 | done | documentación | `phase-03-evidence.md`, `PHASE-03-PLAN.md`, `PHASE-GATES.md` y este STATUS |

## Verificación automatizada

| Comando | Resultado | Evidencia |
|---|---|---|
| `pnpm typecheck` | pass | tipos del adapter, RPC y tests |
| `pnpm test:f03` | pass | 1 archivo, 2 tests del adapter |
| `pnpm spike:omp-adapter` | pass | emulador: v2, streaming, host tool, settled |
| `pnpm spike:omp-adapter --real` | blocked | binario real sin modelo configurado |
| `pnpm build:all` | pass | Electron renderer/main compilados |
| `pnpm lint` | pass | ESLint sin errores |
| `pnpm test` | pass | 5 archivos, 11 tests |
| `pnpm test:e2e` | pass | shell real y screenshots Fase 01 |

## Smoke emulado observado

```json
{
  "mode": "emulator",
  "status": "settled",
  "protocolVersion": 2,
  "events": [
    "ready",
    "message_update",
    "host_tool_call",
    "prompt_result",
    "session_settled"
  ]
}
```

## Probe real observado

El probe usa `omp --mode rpc`, perfil `projectstudio-phase03`, `session-dir` aislado y cwd explícito. El binario local observado es `omp/18.12.6`. El resultado actual es `blocked` antes de `ready`:

```text
No default model selected.
Use /login, set an API key environment variable, or select a local model with /model.
```

No se tocaron credenciales. El emulador no se presenta como compatibilidad real.

## Alcance implementado

- Negociación v2 cuando `ready.supportedProtocolVersions` incluye 2.
- Consulta de `get_state`, `get_available_models`, `get_available_commands` y `set_host_tools` durante startup.
- Estados `starting`, `ready`, `submitting`, `streaming`, `tool-waiting`, `completing`, `aborting`, `settled` y `failed`.
- Eventos tipados para deltas, llamadas host, resultados, colas, warnings y settled.
- Selección automática de `prompt`, `steer` o `follow_up` según estado y política.
- Respuesta de host tool permitida o denegada, con protección de cierre si el proceso ya terminó.
- `sessionKey` y opciones explícitas de cwd/profile/session-dir.

## Limitaciones reales

1. El OMP real sigue bloqueado por ausencia de modelo local/configuración autorizada.
2. La persistencia física del transcript se delega al `profile`/`session-dir` de OMP; la persistencia lógica ProjectStudio aún no está integrada con SQLite.
3. La UI React sigue chat demo local; no se conectó todavía al adapter.
4. No se inició Workbench vivo, VAB ni captura nueva.
5. No se ejecutan side effects externos ni Permission Broker real.
6. El proyecto `notes` no se analiza ni modifica.

## Evidencia visual vigente

Fase 03 no modifica la superficie visual. Se mantienen las capturas reales de Fase 01:

- `docs/implementation/evidence/F01-T03-desktop-dark.png`
- `docs/implementation/evidence/F01-T03-desktop-light.png`

## Checklist manual GATE-03 — pendiente del usuario

- [ ] Ejecutar `pnpm test:f03` y revisar los 2 tests del adapter.
- [ ] Ejecutar `pnpm spike:omp-adapter` y comprobar `status=settled`, `protocolVersion=2` y eventos de streaming/host/settled.
- [ ] Ejecutar `pnpm spike:omp-adapter --real` y revisar el bloqueo real `No default model selected`.
- [ ] Confirmar que el adapter no presenta el emulador como OMP real.
- [ ] Revisar `packages/omp-bridge/src/omp-adapter.ts` y `docs/implementation/phase-03-evidence.md`.
- [ ] Ejecutar `pnpm build:all && pnpm lint && pnpm test && pnpm test:e2e`.
- [ ] Confirmar que la UI sigue demo local y que no se inició Fase 04.
- [ ] Decidir `APPROVED`, `CHANGES_REQUESTED` o `REJECTED` para GATE-03.

## Historial

- Base inicial: `c7cc3e5`.
- Fase 00: `0a4a2bf chore: bootstrap phase 00 contracts and spikes`.
- README: `4c253a0 docs: add desktop run instructions`.
- Fase 01: `1aea0a9 feat: add phase 01 electron react shell`.
- Fase 02: `8abe2b4 feat: add persistent langgraph workflows`.

## User gate

`WAITING_USER_APPROVAL`. No push será realizado. No se inicia Fase 04 hasta una decisión explícita del usuario.
