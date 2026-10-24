# ProjectStudio

Shell de escritorio Electron + React para ProjectStudio. La implementación actual corresponde a **Fase 04**: chat visible conectado al adaptador OMP RPC v2. OMP instalado y autenticado es un requisito del usuario; la app no hace fallback silencioso al emulador.

## Requisitos

- macOS (target actual).
- Node.js `24.x` recomendado.
- pnpm `10.16.1`.
- OMP `18.12.6` o compatible, instalado en PATH como `omp`.
- Una sesión OMP autenticada y un modelo seleccionado.

Comprobar versiones:

```bash
node --version
pnpm --version
omp --version
```

Configurar OMP antes de abrir ProjectStudio:

```bash
omp login
```

Después selecciona o configura un modelo en OMP. ProjectStudio reutiliza la autenticación/configuración OMP del usuario, pero no gestiona credenciales.

## Ejecutar la aplicación

Desde la raíz del repositorio:

```bash
pnpm install
pnpm desktop
```

`pnpm desktop` compila el renderer, el proceso principal y el bridge OMP, y abre la ventana de ProjectStudio.

El modo normal es OMP real. El panel debe mostrar `OMP · REAL`; una instalación sin login/modelo muestra el error de configuración en el chat.

## Qué comprobar manualmente

1. Cambia entre `Resumen`, `ProductShape`, `Arquitectura`, `Evidencia` y `Cambios`.
2. Cambia el proyecto en el selector superior.
3. Cambia entre tema oscuro y claro.
4. Arrastra el borde del explorador izquierdo y del chat derecho.
5. Escribe `¿Qué componentes tiene este proyecto?` en el chat y pulsa `Enviar`.
6. Comprueba que aparecen deltas parciales y una respuesta final del modelo configurado.
7. Comprueba que el estado del chat termina en `settled`.
8. Abre el menú `Ver` para probar Reload, DevTools y fullscreen.

El selector `notes · brownfield pendiente` es sólo una etiqueta visual. El proyecto externo `notes` no se analiza ni modifica todavía.

## Ejecutar verificaciones

Regresión completa:

```bash
pnpm build:all
pnpm lint
pnpm test
pnpm test:e2e
```

Tests y smoke específicos:

```bash
pnpm test:f03
pnpm spike:omp-adapter
pnpm spike:omp-adapter --real
pnpm test:e2e:real
```

El smoke de Playwright abre Electron, envía un mensaje por IPC y genera capturas reales en:

```text
docs/implementation/evidence/F04-T01-desktop-chat-dark.png
docs/implementation/evidence/F04-T01-desktop-chat-light.png
docs/implementation/evidence/F04-T02-desktop-chat-live.png
docs/implementation/evidence/F04-T03-desktop-chat-real.png
```

El smoke E2E usa el emulador únicamente para ser determinista y lo fuerza explícitamente:

```bash
PROJECTSTUDIO_OMP_MODE=emulator pnpm test:e2e
```

Ese emulador no es el modo de producto. Para cambiar el binario OMP real:

```bash
OMP_BIN=/ruta/a/omp pnpm desktop
```

## Documentación de implementación

- Estado actual: `docs/implementation/STATUS.md`
- Evidencia Fase 03: `docs/implementation/phase-03-evidence.md`
- Evidencia Fase 04: `docs/implementation/phase-04-evidence.md`
- Checklist de gates: `docs/implementation/PHASE-GATES.md`

## Desarrollo

Para compilar sin abrir Electron:

```bash
pnpm build:all
```

Para cerrar la ventana, usa `Cmd+Q` o el menú `ProjectStudio > Quit ProjectStudio`.
