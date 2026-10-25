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
13. En el chat inicial confirma que aparece la personalidad `Arquitecto de Proyecto` y los objetivos `Entender el proyecto` y `Documentar arquitectura`.
14. Pulsa uno de esos objetivos o escribe una pregunta nueva en el composer visible del panel derecho.
## Verificación determinista sin lanzar la aplicación

La primera capa no abre Electron, no inicia OMP y no consume tokens:

```bash
pnpm verify:pdac:scenarios
PROJECTSTUDIO_PROJECT_ROOT=/Users/luis/projects/notes pnpm verify:pdac:static -- --expect-brownfield
pnpm verify:ui:static
pnpm typecheck && pnpm typecheck:desktop && pnpm lint
```

`verify:pdac:scenarios` valida la matriz 10 Greenfield + 10 Brownfield. `verify:pdac:static` valida schema, nodos, relaciones, rutas de evidencia y ausencia de texto transitorio (`Objetivo actual`, `Hallazgo publicado`, prompts de revisión). `verify:ui:static` comprueba el contrato del renderer: foco filtrado, anuncio del timer, target elegido, botones deshabilitados y detalle largo sólo en el resumen.
Al pulsar un foco de artefacto, ProjectStudio intenta primero `prodshape graph --format json` con ProductShape `0.23.0`; sólo si el grafo no existe o está vacío delega la recuperación semántica a OMP. La CLI debe poder invocarse directamente o mediante `pnpm --package=@prodshape/cli@0.23.0 dlx prodshape`.

Notes está deliberadamente vacío de PDAC, pero conserva código fuente visible; por eso es Brownfield sin modelo ProductShape, no Greenfield. La copia reversible está fuera del proyecto:

```text
/Users/luis/projects/notes-pdac-backup-202603/
```

No se borró código fuente, tests ni cambios de trabajo de Notes.

## Verificar personalidad, persistencia y lienzos

Las pruebas E2E usan OMP real; no hay mock de OMP. Requieren `omp login`, un modelo configurado y una red disponible para el proveedor:

```bash
pnpm test:e2e:personality-timer
pnpm test:e2e:pdac-matrix-20
```

`test:e2e:personality-timer` selecciona el umbral de 10 segundos, verifica que la cuenta atrás avanza, que el trabajo proactivo termina y que el prompt interno no aparece en el chat.

`test:e2e:pdac-matrix-20` crea 10 proyectos greenfield y 10 brownfield temporales. En cada caso ejecuta OMP, abre los ocho focos PDAC, exige un lienzo no vacío al terminar la actividad, edita un nodo tldraw, comprueba que el título llega a `.product/generated/product-graph.json`, cierra/reabre Electron y verifica proyecto, foco y persistencia. Las carpetas temporales se eliminan al terminar.

Evidencia generada:

```text
docs/implementation/evidence/F07-personality-timer-report.json
docs/implementation/evidence/F07-pdac-matrix-20/
```

Para probarlo a mano con Notes:

1. Ejecuta `pnpm desktop:notes`.
2. En ProductShape selecciona un foco PDAC; el centro debe mostrar un único estado de actividad y un lienzo tldraw.
3. Deja seleccionado el umbral de `10 s` en el pie del chat y no escribas una pregunta: la personalidad puede proponer una revisión.
4. Escribe una pregunta sin enviarla: el timer no debe enviar trabajo mientras el composer contiene texto pendiente.
5. Espera a que OMP llegue a `Listo para continuar`; comprueba que el resultado aparece en el centro, no como prompt interno.
6. Doble clic en una figura, cambia su texto y cierra/abre la app. El lienzo debe conservar el cambio; el grafo de proyecto debe reflejarlo.

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
pnpm test:e2e:journey
pnpm test:e2e:journey:scenarios
pnpm test:e2e:projects
pnpm test:e2e:notes:diagram
```

`test:f04` usa el OMP instalado y autenticado por el usuario y recorre el click de un objetivo hasta la respuesta real. `test:e2e:journey` verifica discovery interrumpido y reanudable. `test:e2e:journey:scenarios` recorre proyecto existente, referencia nueva, discovery activo con objetivo encolado y error OMP. `test:e2e:projects` prueba el archivado reversible y confirma que la ruta sigue existiendo. `test:e2e:notes:diagram` reutiliza el Mermaid almacenado, no envía prompts ni consume tokens.

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
- Journey brownfield: `docs/implementation/JOURNEY-BROWNFIELD.md`
- Evidencia Fase 03: `docs/implementation/phase-03-evidence.md`
- Evidencia Fase 04: `docs/implementation/phase-04-evidence.md`
- Checklist de gates: `docs/implementation/PHASE-GATES.md`
- ProductShape canónico: `docs/product/README.md`


## Desarrollo

Para compilar sin abrir Electron:

```bash
pnpm build:all
```

Para cerrar la ventana, usa `Cmd+Q` o el menú `ProjectStudio > Quit ProjectStudio`.
