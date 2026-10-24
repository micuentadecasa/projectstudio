# Fase 04 — evidencia de chat OMP

## Resultado

El chat de la aplicación ya atraviesa el proceso completo:

```text
React renderer
  → contextBridge/preload
  → Electron ipcMain
  → OmpAdapter
  → RpcClient
  → OMP real instalado y autenticado por el usuario
  → eventos IPC
  → mensajes visibles en React
```

## Tareas

| ID | Estado | Output | Evidencia |
|---|---|---|---|
| F04-T01 | done | `apps/desktop/src/main.ts`, `apps/desktop/preload.cjs` | IPC aislado y sesión OMP por proceso |
| F04-T02 | done | `apps/desktop/src/renderer/main.tsx` | streaming, respuesta final, estado y errores visibles |
| F04-T03 | done | `apps/desktop/src/renderer/renderer.d.ts` | eventos tipados en el renderer |
| F04-T04 | done | `tests/e2e/desktop-smoke.ts` | mensaje real enviado y `OMP_REAL_OK` recibido |
| F04-T05 | done | capturas PNG | dark/light y respuesta real visible |

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
    "docs/implementation/evidence/F04-T03-desktop-chat-real.png"
  ]
}
```

El smoke de Electron usa el OMP real instalado y autenticado. La captura `F04-T03-desktop-chat-real.png` muestra `OMP_REAL_OK` y estado `settled`.

## Configuración OMP requerida

El modo normal del producto usa el OMP instalado por el usuario:

```bash
omp --version
omp login
pnpm desktop
```

El usuario debe dejar un modelo seleccionado/configurado en OMP. ProjectStudio reutiliza la configuración global y no crea un perfil vacío ni gestiona credenciales.

La prueba requiere el proceso OMP real y el modelo configurado por el usuario. No se ejecuta con emulador ni fallback.

La compatibilidad real necesitó leer `message_update.assistantMessageEvent.delta`; los deltas no llegan siempre en `frame.delta`. La prueba Electron real cubre esta forma de wire.
