# ProjectStudio

Shell de escritorio Electron + React para ProjectStudio. La implementación actual corresponde a **Fase 04**: chat visible conectado al adaptador OMP RPC v2. OMP instalado y autenticado es un requisito del usuario; no hay fallback silencioso ni emulador en producto o verificaciones.

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

Para inspeccionar otro repositorio local, incluido DrumCoach cuando exista en esta máquina:

```bash
PROJECTSTUDIO_PROJECT_ROOT=/ruta/absoluta/al/proyecto pnpm desktop
```

El proceso OMP recibe esa ruta como `cwd`; las sesiones se guardan en `.tmp/omp-sessions` de ProjectStudio. El selector muestra el nombre real del repositorio y queda bloqueado para evitar fingir un cambio de cwd que no se ha ejecutado.

## Qué comprobar manualmente

1. Cambia entre `Resumen`, `ProductShape`, `Arquitectura`, `Evidencia` y `Cambios`.
2. Comprueba que el selector muestra el nombre del repositorio configurado por `PROJECTSTUDIO_PROJECT_ROOT`.
3. Cambia entre tema oscuro y claro.
4. Arrastra el borde del explorador izquierdo y del chat derecho.
5. Escribe `Revisa el proyecto seleccionado y genera un diagrama Mermaid basado sólo en el código real.` en el chat y pulsa `Enviar`.
6. Comprueba que aparecen deltas parciales y una respuesta final del modelo configurado.
7. Comprueba que el estado del chat termina en `settled`.
8. Abre el menú `Ver` para probar Reload, DevTools y fullscreen.

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
pnpm spike:omp
pnpm test:e2e
```

El smoke de Playwright usa el OMP instalado y autenticado por el usuario. Genera capturas reales en:

```text
docs/implementation/evidence/F04-T01-desktop-chat-dark.png
docs/implementation/evidence/F04-T01-desktop-chat-light.png
docs/implementation/evidence/F04-T03-desktop-chat-real.png
```


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
