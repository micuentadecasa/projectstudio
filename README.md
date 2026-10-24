# ProjectStudio

Shell de escritorio Electron + React para ProjectStudio. La implementación actual corresponde a **Fase 04**: chat visible conectado al adaptador OMP RPC v2 mediante un emulador local reproducible.

## Requisitos

- macOS (target actual).
- Node.js `24.x` recomendado.
- pnpm `10.16.1`.

Comprobar versiones:

```bash
node --version
pnpm --version
```

## Ejecutar la aplicación

Desde la raíz del repositorio:

```bash
pnpm install
pnpm desktop
```

`pnpm desktop` compila el renderer, el proceso principal y el bridge OMP, y abre la ventana de ProjectStudio.

Por defecto la app usa el emulador RPC local para que el chat sea reproducible sin credenciales. El panel lo etiqueta como `EMULADOR`.

## Qué comprobar manualmente

1. Cambia entre `Resumen`, `ProductShape`, `Arquitectura`, `Evidencia` y `Cambios`.
2. Cambia el proyecto en el selector superior.
3. Cambia entre tema oscuro y claro.
4. Arrastra el borde del explorador izquierdo y del chat derecho.
5. Escribe `¿Qué componentes tiene este proyecto?` en el chat y pulsa `Enviar`.
6. Comprueba que aparece una respuesta parcial y después `fixture complete`.
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
```

El smoke de Playwright abre Electron, envía un mensaje por IPC y genera capturas reales en:

```text
docs/implementation/evidence/F04-T01-desktop-chat-dark.png
docs/implementation/evidence/F04-T01-desktop-chat-light.png
docs/implementation/evidence/F04-T02-desktop-chat-live.png
```

Para probar el binario real, sin credenciales añadidas por ProjectStudio:

```bash
PROJECTSTUDIO_OMP_MODE=real pnpm desktop
```

Se puede seleccionar otro binario con `OMP_BIN=/ruta/a/omp`. La máquina de desarrollo actual queda bloqueada si OMP no tiene un modelo seleccionado.

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
