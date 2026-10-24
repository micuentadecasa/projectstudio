# ProjectStudio

Shell de escritorio Electron + React para ProjectStudio. La implementación actual corresponde a **Fase 01**: navegación visual, proyecto demo, tema oscuro/claro y chat local de demostración.

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

`pnpm desktop` compila el renderer y Electron, y abre la ventana de ProjectStudio.

La app de Fase 01 funciona con datos demo locales. El chat no conecta todavía con OMP real; esa integración queda para una fase posterior.

## Qué comprobar manualmente

1. Cambia entre `Resumen`, `ProductShape`, `Arquitectura`, `Evidencia` y `Cambios`.
2. Cambia el proyecto en el selector superior.
3. Cambia entre tema oscuro y claro.
4. Arrastra el borde del explorador izquierdo y del chat derecho.
5. Abre las tabs de `ProductShape` y `Arquitectura`.
6. Escribe un mensaje en el chat y pulsa `Enviar`.
7. Abre el menú `Ver` para probar Reload, DevTools y fullscreen.

El selector `notes · brownfield pendiente` es sólo una etiqueta visual. El proyecto externo `notes` no se analiza ni modifica en esta fase.

## Ejecutar verificaciones

Smoke completo de Fase 01:

```bash
pnpm test:f01
```

Comandos separados:

```bash
pnpm build:desktop
pnpm typecheck:desktop
pnpm lint
pnpm test
pnpm test:e2e
```

El smoke de Playwright abre Electron y genera capturas reales en:

```text
docs/implementation/evidence/F01-T03-desktop-dark.png
docs/implementation/evidence/F01-T03-desktop-light.png
```

## Documentación de implementación

- Estado y gate actual: `docs/implementation/STATUS.md`
- Evidencia Fase 01: `docs/implementation/phase-01-evidence.md`
- Checklist del gate: `docs/implementation/PHASE-GATES.md`

## Desarrollo

Para arrancar Vite/Electron con el build actual:

```bash
pnpm build:desktop
```

Para cerrar la ventana, usa `Cmd+Q` o el menú `ProjectStudio > Quit ProjectStudio`.
