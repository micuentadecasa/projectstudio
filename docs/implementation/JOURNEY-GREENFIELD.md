# Journey Greenfield — primer diseño PDAC

## Objetivo

Una persona abre una carpeta local vacía y quiere convertir una idea en un primer diseño de producto. ProjectStudio no intenta inspeccionar código inexistente ni inicia arquitectura prematuramente: detecta el modo **Greenfield**, muestra una entrevista PDAC y usa OMP real sólo cuando la persona aporta una intención.

## Recorrido esperado

1. **Añadir carpeta**: el selector conserva sólo una referencia local. La aplicación no crea, borra ni modifica archivos del proyecto.
2. **Detectar Greenfield**: la carpeta se considera vacía cuando no contiene entradas visibles; `.git`, `.gitkeep` y `node_modules` no cuentan. El registro persiste `mode: greenfield` y las señales detectadas.
3. **Orientar sin bloquear**: ProductShape muestra `GREENFIELD · DISEÑO PDAC`, `Nuevo producto`, `ENTREVISTA` y la instrucción «Cuéntame el primer caso de uso». El chat contiene una única guía inicial, no un prompt interno.
4. **Comenzar entrevista**: el usuario puede escribir el caso de uso o pulsar `Empezar`. El workflow se envía a OMP mediante LangGraph; el prompt de coordinación queda oculto.
5. **Preguntar una decisión cada vez**: el agente pregunta, en orden flexible, por objetivo, actor, disparador, resultado, excepciones, reglas y fuera de alcance. Después de cada respuesta resume lo entendido y formula sólo la siguiente pregunta.
6. **Mostrar progreso útil**: el centro presenta una línea breve de actividad. El chat muestra la respuesta comprensible; no muestra RPC, frames, herramientas ni checkpoints.
7. **Proponer borrador**: cuando hay suficiente claridad, OMP devuelve un PDAC provisional y un Mermaid. La interfaz separa hechos, inferencias y pendientes. Nada pasa a modelo canónico sin confirmación del usuario.
8. **Continuar hacia arquitectura**: sólo después de confirmar el PDAC se habilita el paso de arquitectura. Un Greenfield sin respuestas no muestra «comparar arquitecturas» ni inventa alternativas.

## Escenario reproducible

Fixture: `tests/fixtures/greenfield-empty/` (contiene sólo `.gitkeep`).

```bash
pnpm test:e2e:greenfield
```

La prueba abre Electron con `PROJECTSTUDIO_PROJECT_ROOT` apuntando a la fixture, verifica la detección Greenfield y envía a OMP real:

> Quiero que un músico pueda registrar una canción y practicarla sin conexión.

Comprueba que la respuesta comienza la entrevista PDAC, guarda la captura `F06-T03-greenfield-interview.png` y el texto en `.md`. Consume tokens OMP; requiere `omp login` y un modelo configurado.

## Decisiones de conversación

- El chat es el canal de conversación; la actividad central es un resumen visual, no un segundo chat.
- La entrevista es incremental y reversible: un borrador puede corregirse sin escribir en el repositorio.
- Las páginas de Actores, Casos de uso, Dominio, Journeys, Reglas, Requisitos y Bounded contexts filtran los hallazgos y ofrecen `Profundizar con OMP`.
- La revisión proactiva sólo aplica a brownfield con hallazgos previos: tras 15 minutos sin interacción, el agente puede pedir una revisión breve de contradicciones, cambios o huecos. Greenfield no se interrumpe automáticamente mientras el usuario está definiendo el producto.

## Superficies de trabajo

- La vista de foco actual es dinámica: mantiene visible el spinner, el paso que se está ejecutando, el diagrama provisional y el botón para actualizar sólo ese foco.
- La vista de evidencia es estática: muestra los hallazgos recuperados, su clasificación y, en Dominio, un glosario de términos con descripción y evidencia debajo del grafo.
- `Estado general` devuelve al mapa completo; cambiar a Actores, Dominio o Journeys no obliga a leer de nuevo el resto del PDAC.
