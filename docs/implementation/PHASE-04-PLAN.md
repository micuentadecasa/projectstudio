# Fase 04 — chat OMP visible

## F04-T01 — puente Electron

Conectar el proceso principal de Electron con `OmpAdapter` mediante IPC aislado. El renderer no recibe Node ni ejecuta procesos.

## F04-T02 — chat streaming

Sustituir la respuesta demo local por eventos RPC: `message_update`, `message_end`, `prompt_result`, `session_settled`, warnings y errores. Mostrar estado, modo y sesión en la UI.

## F04-T03 — modo ejecutable

Usar el emulador determinista por defecto para una demo local reproducible. Permitir `PROJECTSTUDIO_OMP_MODE=real` y `OMP_BIN` para probar el binario real sin cambiar el renderer.

## F04-T04 — evidencia

Ejecutar Playwright con mensaje real atravesando renderer → preload → Electron main → OmpAdapter → emulador y vuelta. Capturar la respuesta visible.

## F04-T05 — gate

Actualizar estado y continuar automáticamente con el siguiente slice aprobado por el usuario. El modo emulador siempre queda etiquetado; no se presenta como compatibilidad real.
