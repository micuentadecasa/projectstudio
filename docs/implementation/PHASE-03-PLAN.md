# Fase 03 — adaptador OMP RPC

## F03-T01 — transporte

Conservar `RpcClient` como seam de proceso aislado: JSONL, correlación por ID y decoder de frames v2.

## F03-T02 — adapter

Construir `OmpAdapter` con estados, sesión lógica, negociación, consultas de startup, warnings y cierre.

## F03-T03 — interacción

Traducir streaming, host tools, `follow_up`, `steer`, `abort`, `prompt_result` y `session_settled` a eventos tipados.

## F03-T04 — verificación

Ejecutar emulator y binario OMP real por separado. Si el real no tiene modelo, registrar bloqueo y no disfrazar el emulador como compatibilidad real.

## F03-T05 — gate

Actualizar documentación y detenerse en `WAITING_USER_APPROVAL`. No iniciar Workbench vivo ni capturas VAB.
