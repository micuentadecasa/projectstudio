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

## GATE-02

Entrada: `GATE-01: APPROVED` y Fase 02 como única fase activa.

Salida requerida:

- StateGraph con rutas `navigate` e `inspection`.
- Checkpoints SQLite con `thread_id` y `runId` estable.
- Reapertura de un runtime nuevo y lectura del checkpoint anterior.
- `interrupt()` de inspección con decisiones `approved` y `rejected`.
- No duplicar el evento `workflow.started` al reanudar.
- Audit log verificable por cada transición.
- Tests unitarios/regresión y smoke JSON reproducible.
- `STATUS.md` en `WAITING_USER_APPROVAL`.

Decisión humana: `APPROVED`, `CHANGES_REQUESTED` o `REJECTED`. El silencio no aprueba.

## GATE-03

Entrada: `GATE-02: APPROVED` y Fase 03 como única fase activa.

Salida requerida:

- `OmpAdapter` aislado sobre `omp --mode rpc`.
- Negociación v2 y decoder `rpc_chunk` verificado.
- Streaming de mensajes, `prompt_result` y `session_settled` separados.
- Host tool mínima con `host_tool_call`/`host_tool_result`.
- `steer`, `follow_up`, `abort` y estados del adaptador.
- Sesión lógica con `sessionKey`, cwd/profile/session-dir explícitos.
- Emulador determinista y probe del binario real documentado.
- Si el binario real carece de modelo, el bloqueo queda explícito; no se acepta el emulador como sustituto.
- `STATUS.md` en `WAITING_USER_APPROVAL`.

Decisión humana: `APPROVED`, `CHANGES_REQUESTED` o `REJECTED`. El silencio no aprueba.

## GATE-04

Entrada: aprobación continua del usuario y Fase 04.

Salida requerida:

- IPC Electron aislado entre renderer, preload y proceso OMP.
- Chat visible con modo emulador claramente etiquetado.
- Eventos parciales y final (`message_update`, `message_end`) visibles.
- Estados `ready`, `streaming`, `settled` y errores visibles.
- Modo real configurable por `PROJECTSTUDIO_OMP_MODE=real`.
- E2E con mensaje enviado desde la UI y respuesta recibida.
- Captura visual posterior a la respuesta.
