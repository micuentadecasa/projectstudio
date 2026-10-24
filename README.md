# ProjectStudio

Shell de escritorio Electron + React para ProjectStudio. La implementación actual combina un workbench brownfield con workflows LangGraph y chat de presentación conectado al adaptador OMP RPC v2. OMP instalado y autenticado es un requisito del usuario; no hay fallback silencioso ni emulador en producto o verificaciones.

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

Para abrir el proyecto brownfield Notes usado como ejemplo:

```bash
pnpm desktop:notes
```

Equivale a:

```bash
PROJECTSTUDIO_PROJECT_ROOT=/Users/luis/projects/notes pnpm desktop
```

Para inspeccionar otro repositorio local:

```bash
PROJECTSTUDIO_PROJECT_ROOT=/ruta/absoluta/al/proyecto pnpm desktop
```

El proceso OMP recibe esa ruta como `cwd`; las sesiones se guardan en `.tmp/omp-sessions` de ProjectStudio. El selector superior y el bloque `PROYECTOS` muestran el registro local. `＋` abre otro directorio y lo registra; `⌫` archiva sólo la referencia local: nunca borra ni modifica archivos del repositorio.

## Gestión de proyectos y reanudación

1. Arranca `pnpm desktop` o `pnpm desktop:notes`.
2. En `PROYECTOS`, pulsa `＋` para añadir/crear la referencia a una carpeta local. La carpeta se convierte en el cwd real del siguiente worker OMP.
3. Cambia de proyecto desde el selector superior o la lista lateral. ProjectStudio reinicia el worker con ese cwd.
4. `⌫` archiva la referencia en `.tmp/projectstudio-projects.json`; no ejecuta `rm`, no elimina Git y no toca el proyecto.
5. Al reabrir un proyecto archivado, seleccionarlo vuelve a activarlo y escanea `docs/product`, `productshape`, `docs/architecture`, `architecture` y `docs/adr`. Las señales detectadas aparecen en el explorador.

La persistencia tiene dos capas deliberadas:

- Registro de proyectos: JSON local de ProjectStudio en `.tmp/projectstudio-projects.json`, sólo referencias, estado archivado y señales detectadas.
- Checkpoints de LangGraph: SQLite local en `.tmp/agent-runtime.sqlite`, separado del repositorio analizado.

Los artefactos del proyecto analizado no se borran ni se escriben durante esta gestión. Un proyecto existente puede reaparecer en el registro al iniciar con `PROJECTSTUDIO_PROJECT_ROOT`.

## Qué comprobar manualmente

1. Confirma que `PROYECTOS` lista el proyecto activo y que `ProductShape detectado` / `Arquitectura detectada` aparecen cuando existen esas carpetas.
2. Pulsa `＋`, elige una carpeta y confirma que aparece como nueva referencia.
3. Cambia entre dos proyectos; confirma que cambia el nombre, cwd y estado de detección.
4. Pulsa `⌫`; confirma que la referencia queda como `archivado` y que los archivos del repositorio siguen intactos.
5. Vuelve a seleccionar el proyecto archivado; confirma que se reactiva y vuelve a escanear sus carpetas.
6. Cambia entre `Resumen`, `ProductShape`, `Arquitectura`, `Evidencia` y `Cambios`.
7. Con Notes, `ProductShape` muestra el Mermaid ProductShape previamente guardado en `docs/implementation/evidence/F05-T01-notes-productshape-cli.mermaid`; esto no ejecuta una nueva petición.
8. Pulsa `Revisar y diagramar` arriba a la derecha para enviar la revisión real a OMP automáticamente; no hace falta pulsar `Enter`.
9. En `Arquitectura`, pide que contraste los hallazgos con `src/` y `tests/`.
10. Comprueba progreso resumido, respuesta final del workflow y estado `settled`.
11. Cambia entre tema oscuro y claro; arrastra los bordes del explorador y chat.
12. Si OMP devuelve Mermaid, comprueba el mapa visual en chat y canvas central.
13. En el chat inicial confirma que aparece la personalidad `Arquitecto de Proyecto` y los objetivos `Entender el proyecto`, `Documentar arquitectura` y `Comparar local / AWS`.
14. Pulsa uno de esos objetivos o escribe una pregunta nueva en el composer visible del panel derecho.
## Cómo se ejecutan las peticiones

El chat y los botones no llaman a OMP directamente. Envían un comando al proceso principal; el workflow LangGraph selecciona el flujo (brownfield, documentación de arquitectura o propuesta local/cloud) y sólo su nodo de agente invoca OMP. La UI muestra progreso resumido y resultados publicados; no muestra prompts, argumentos de herramientas ni frames RPC.

La arquitectura de planificación mantiene la arquitectura aceptada como baseline y genera una propuesta aislada de Architecture Lab. Ninguna propuesta modifica código o despliegue sin un gate explícito.

## Ejecutar verificaciones

Regresión local:

```bash
pnpm build:all
pnpm lint
pnpm test
```

Smoke Electron real:

```bash
pnpm test:f04
pnpm test:e2e:projects
pnpm test:e2e:notes:diagram
```

`test:f04` usa el OMP instalado y autenticado por el usuario. `test:e2e:projects` prueba el archivado reversible y confirma que la ruta sigue existiendo. `test:e2e:notes:diagram` reutiliza el Mermaid almacenado, no envía prompts ni consume tokens.

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
