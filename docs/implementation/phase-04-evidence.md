# Fase 04 — evidencia de chat OMP

## Resultado

El chat de la aplicación ya atraviesa el proceso completo:

```text
React renderer
  → contextBridge/preload
  → Electron ipcMain
  → OmpAdapter
  → RpcClient
  → emulador OMP RPC v2
  → eventos IPC
  → mensajes visibles en React
```

## Tareas

| ID | Estado | Output | Evidencia |
|---|---|---|---|
| F04-T01 | done | `apps/desktop/src/main.ts`, `apps/desktop/preload.cjs` | IPC aislado y sesión OMP por proceso |
| F04-T02 | done | `apps/desktop/src/renderer/main.tsx` | streaming, respuesta final, estado y errores visibles |
| F04-T03 | done | `apps/desktop/src/renderer/renderer.d.ts` | eventos tipados en el renderer |
| F04-T04 | done | `tests/e2e/desktop-smoke.ts` | mensaje enviado y `fixture complete` recibido |
| F04-T05 | done | capturas PNG | dark/light y respuesta visible |

## Comando reproducible

```bash
pnpm build:all
pnpm test:e2e
```

Salida observada:

```json
{
  "title": "ProjectStudio",
  "activeSection": "Arquitectura",
  "theme": "app-shell light",
  "screenshots": [
    "docs/implementation/evidence/F04-T01-desktop-chat-dark.png",
    "docs/implementation/evidence/F04-T01-desktop-chat-light.png",
    "docs/implementation/evidence/F04-T02-desktop-chat-live.png"
  ]
}
```

La captura `F04-T02-desktop-chat-live.png` muestra el mensaje del usuario y la respuesta `fixture complete` con estado `settled`.

## Modo real

El renderer soporta:

```bash
PROJECTSTUDIO_OMP_MODE=real pnpm desktop
```

Ese modo usa `omp` o el binario indicado por `OMP_BIN`. La máquina actual sigue bloqueada antes de `ready` por `No default model selected`; la UI muestra el error y no lo confunde con el emulador.

## Limitación

La respuesta visible de la captura es del emulador determinista, no de un modelo remoto. La ruta de producción queda preparada para el binario real, pero su prueba funcional depende de configurar un modelo autorizado.
