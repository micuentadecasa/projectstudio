# Fase 04 — evidencia de chat OMP

## Resultado

El chat de la aplicación ya atraviesa el proceso completo:

```text
React renderer
  → contextBridge/preload
  → Electron ipcMain
  → OmpAdapter
  → RpcClient
  → OMP real (default) or emulator (tests only)
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
| F04-T06 | done | `tests/e2e/desktop-real-chat.ts` | OMP real desde Electron: 3 mensajes y `OMP_REAL_OK` |

## Comando reproducible

```bash
pnpm build:all
pnpm test:e2e
```

Smoke Electron con OMP real:

```bash
pnpm test:e2e:real
```

Salida del smoke emulado:

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

Salida del smoke Electron real:

```json
{
  "mode": "real",
  "responseMessages": 3,
  "screenshot": "docs/implementation/evidence/F04-T03-desktop-chat-real.png"
}
```

`F04-T02` muestra el emulador. `F04-T03` muestra OMP real, la pregunta del usuario, la respuesta `OMP_REAL_OK` y estado `settled`.

## Configuración OMP requerida

El modo normal del producto usa el OMP instalado por el usuario:

```bash
omp --version
omp login
pnpm desktop
```

El usuario debe dejar un modelo seleccionado/configurado en OMP. ProjectStudio reutiliza la configuración global y no crea un perfil vacío ni gestiona credenciales.

El modo emulador existe sólo para tests deterministas:

```bash
PROJECTSTUDIO_OMP_MODE=emulator pnpm test:e2e
```

La captura visual `F04-T02-desktop-chat-live.png` sigue siendo evidencia del circuito UI/IPC con emulador; no se presenta como respuesta de un modelo real.

La compatibilidad real necesitó leer `message_update.assistantMessageEvent.delta`; los deltas no llegan siempre en `frame.delta`. La prueba Electron real cubre esta forma de wire.
