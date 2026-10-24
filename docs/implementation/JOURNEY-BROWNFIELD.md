# Journey principal — documentar un brownfield con ProjectStudio

## Usuario

Product manager o responsable técnico que recibe un repositorio existente y necesita entenderlo sin leer todo el código a ciegas, conservar evidencia y decidir el siguiente paso con el equipo.

## Resultado esperado

Terminar con:

- proyecto local identificado y recuperable;
- ProductShape y arquitectura detectados cuando existen;
- inventario y hallazgos separados en hechos, inferencias e incógnitas;
- un primer diagrama basado en evidencia;
- una recomendación de siguiente paso, sin proponer una arquitectura alternativa antes de conocer el baseline.

## Recorrido

| Paso | Acción del usuario | Lo que debe ver | Workflow / fuente | Criterio de salida |
|---|---|---|---|---|
| 1. Abrir | Ejecuta ProjectStudio con un repo local | Lista de proyectos, nombre, cwd y señales detectadas | Registro local + filesystem | El proyecto activo es inequívoco |
| 2. Reconocer | Mira `ProductShape detectado` y `Arquitectura detectada` | Señales de carpetas reales, no afirmaciones del agente | Detector determinista | Decide si el proyecto tiene documentación reutilizable |
| 3. Orientarse | Lee el saludo del `Arquitecto de Proyecto` | Personalidad, límites y dos objetivos: entender producto o documentar arquitectura | UI + prompt de personalidad del workflow | Puede empezar sin inventar una pregunta |
| 4. Descubrir | Pulsa **Entender el proyecto** | Estado y progreso arriba del contenido; actividad resumida en el chat; no prompts, RPC frames ni razonamiento interno | `brownfield-discovery` → LangGraph → OMP real | El objetivo se ejecuta o queda en cola si el bootstrap sigue activo |
| 5. Ver evidencia | Navega mientras el agente trabaja | Actividad, respuesta final y diagrama con rutas/evidencia | Eventos normalizados + artefacto guardado | Puede distinguir observado de inferido |
| 6. Documentar | Pulsa **Documentar arquitectura** cuando el baseline esté disponible | Arquitectura existente, no una propuesta cloud prematura | `architecture-documentation` | Existe una vista que el equipo puede revisar |
| 7. Preguntar | Escribe una pregunta concreta en el composer derecho | Respuesta contextual al proyecto activo | Mismo CommandBus/workflow, no canal directo | La respuesta conserva el contexto del proyecto |
| 8. Retomar | Cierra, vuelve a abrir o selecciona un proyecto archivado | Registro, cwd y señales reconstruidos | `.tmp/projectstudio-projects.json` + detector | El repo no se ha borrado ni modificado por archivar |

## ProductShape asistido: qué hace el usuario y qué hace el asistente

El usuario no opera el CLI ni debe leer el repositorio entero. Su recorrido es:

1. Abre el repositorio y confirma que las señales detectadas corresponden al proyecto.
2. Deja que el asistente arranque el descubrimiento o pulsa **Revisar y diagramar** si quiere repetirlo.
3. Lee **Lo que va encontrando**: propósito, actores, casos de uso, restricciones y rutas de evidencia. Cada tarjeta es un resumen de una salida real de OMP, no una actividad decorativa.
4. Cuando el stream identifica una sección de casos de uso, la interfaz anuncia **Nuevo caso de uso** y añade el hallazgo al timeline vivo.
5. Mira el mapa provisional, que puede aparecer antes de que termine el mensaje si el bloque Mermaid ya está disponible. El canvas ocupa el área principal y conserva revisiones anteriores.
6. Pulsa **Casos de uso**, **Actores**, **Reglas y restricciones** o **Bounded contexts** para abrir la página de esa entidad desde el estado PDAC.
7. Pregunta sobre un hallazgo o abre la evidencia. No se promueve nada al ProductShape canónico sin revisión posterior.

Cada página de entidad filtra la evidencia disponible, muestra el número de hallazgos y conserva el contexto del mapa. **Profundizar con OMP** lanza una consulta específica para esa entidad; el usuario puede volver al estado PDAC sin perder la revisión seleccionada.

Durante el análisis, la aplicación muestra la etapa y permite seguir navegando. El timeline entra con una transición breve y mantiene un pulso mientras OMP trabaja; no genera una revisión por cada token ni sustituye un modelo aceptado.


## Reglas de producto

1. El saludo debe sugerir el primer trabajo útil. `Listo. Elige un objetivo` sin acciones visibles no es suficiente.
2. **Comparar local/AWS no aparece en este journey**: requiere primero una arquitectura baseline documentada y aceptada.
3. El bootstrap puede seguir activo cuando el usuario decide el siguiente objetivo. El objetivo se encola; el usuario no debe tener que adivinar por qué un botón no responde.
4. Los mensajes internos de OMP pertenecen al canal de control. La superficie de usuario sólo muestra progreso, resultado y evidencia.
5. Archivar una referencia es reversible y nunca borra el repositorio.
6. Un resultado tardío no puede publicarse en otro proyecto tras cambiar de cwd.

## Verificación automatizada asociada

- `pnpm test:e2e:journey:scenarios`: proyecto existente, referencia nueva, discovery activo con objetivo encolado, error OMP y cambio de contexto.
- `pnpm test:f04`: pasos 3–7 con OMP real; hace clic en **Entender el proyecto**, verifica respuesta final y ausencia de prompt interno.
- `pnpm test:e2e:notes:diagram`: pasos 1–2 y 5 con el artefacto Mermaid almacenado; `tokensUsed: false`.
- `pnpm test:e2e:projects`: paso 8; archiva la referencia y verifica que la ruta sigue existiendo.

## Próxima extensión deliberadamente fuera de este journey

Cuando exista el baseline aceptado, añadir un journey separado para Architecture Lab: crear una propuesta local/AWS/Azure aislada, compararla con el baseline y pedir aprobación. No mezclarlo con el primer descubrimiento brownfield.
