✦
OMP
Objetivo actual

Reconstruir el producto desde `docs/product` y verificarlo contra el código, sin ampliar el alcance ni asumir componentes no evidenciados.

Hallazgos verificables

Propósito y frontera

DrumCoach es una herramienta personal, local-first, para convertir material musical permitido en material practicable.

El flujo principal documentado es:

1. El aprendiz aporta audio, vídeo, MIDI o imagen de partitura.
2. El sistema genera una o más partes instrumentales.
3. Persiste una revisión de `Practice Score`.
4. Produce notación y reproducción sincronizada.
5. El aprendiz consulta la biblioteca local y practica una selección.

Evidencia: [`docs/product/architecture.md#L5-L9`](docs/product/architecture.md#L5-L9), [`docs/product/architecture.md#L34-L40`](docs/product/architecture.md#L34-L40).

La frontera excluye explícitamente catálogo alojado, autenticación, API pública de transcripción, cola distribuida y soporte de producción. La aplicación, SQLite, artefactos y runtimes operan en una máquina local: [`docs/product/architecture.md#L5-L9`](docs/product/architecture.md#L5-L9), [`docs/product/model/business-rules/br-local-first.md#L13-L24`](docs/product/model/business-rules/br-local-first.md#L13-L24).

El código corrobora esa frontera mediante endpoints FastAPI locales, jobs persistidos y rutas de biblioteca/práctica en [`src/drumcoach_app/main.py#L870-L1011`](src/drumcoach_app/main.py#L870-L1011) y [`src/drumcoach_app/repository.py#L188-L253`](src/drumcoach_app/repository.py#L188-L253).

Actores

| Actor | Responsabilidad confirmada | Evidencia |
|---|---|---|
| Learner | Seleccionar fuentes, elegir instrumento, revisar scores, leer notación y practicar rangos | [`docs/product/model/actors/act-learner.md#L13-L23`](docs/product/model/actors/act-learner.md#L13-L23) |
| Local operator | Instalar dependencias, lanzar aplicación/worker, configurar rutas y revisar fallos | [`docs/product/model/actors/act-local-operator.md#L13-L23`](docs/product/model/actors/act-local-operator.md#L13-L23) |
| MuScriptor | Producir eventos locales de transcripción para perfiles instrumentales | [`docs/product/model/actors/act-muscriptor.md#L13-L23`](docs/product/model/actors/act-muscriptor.md#L13-L23) |
| Optional OMR runtime | Convertir una imagen de partitura en MusicXML | [`docs/product/model/actors/act-omr-runtime.md#L13-L23`](docs/product/model/actors/act-omr-runtime.md#L13-L23) |

No hay evidencia de un actor de administración, cliente remoto o usuario autenticado.

Casos de uso

1. Importar material fuente
• Audio local, URL de YouTube, eventos crudos o imagen de partitura.
• Puede ser una familia instrumental o un bundle con jobs hijos.
• Evidencia: [`docs/product/model/use-cases/uc-import-source.md#L16-L35`](docs/product/model/use-cases/uc-import-source.md#L16-L35), [`src/drumcoach_app/main.py#L970-L1008`](src/drumcoach_app/main.py#L970-L1008).

2. Ejecutar jobs de importación local
• Procesar un job cada vez, recuperar jobs `running` obsoletos y dejar estado durable.
• Evidencia: [`docs/product/model/use-cases/uc-run-local-worker.md#L16-L35`](docs/product/model/use-cases/uc-run-local-worker.md#L16-L35), [`src/drumcoach_app/main.py#L185-L231`](src/drumcoach_app/main.py#L185-L231).

3. Importar imagen de partitura
• Acepta PNG, JPEG y WebP; crea una parte de teclado mediante OMR.
• PDF no está soportado.
• Evidencia: [`docs/product/model/use-cases/uc-import-score-image.md#L16-L35`](docs/product/model/use-cases/uc-import-score-image.md#L16-L35), [`src/drumcoach_app/main.py#L920-L968`](src/drumcoach_app/main.py#L920-L968).

4. Persistir y consultar material
• Crear `Song`, `Instrument Part` y `Practice Score Revision`, conservando revisiones anteriores.
• Evidencia: [`docs/product/model/use-cases/uc-browse-library.md#L16-L34`](docs/product/model/use-cases/uc-browse-library.md#L16-L34), [`src/drumcoach_app/repository.py#L593-L714`](src/drumcoach_app/repository.py#L593-L714).

5. Practicar una revisión activa
• Cargar notación, reproducción generada, selección, tempo, bucle, metrónomo, cuenta de entrada y audio original cuando esté disponible.
• Evidencia: [`docs/product/model/use-cases/uc-practise-score.md#L16-L35`](docs/product/model/use-cases/uc-practise-score.md#L16-L35), [`src/drumcoach_app/player.py#L379-L475`](src/drumcoach_app/player.py#L379-L475).

6. Solicitar coaching contextual
• Analizar una selección, crear un plan pedagógico y proponer acciones de reproducción sujetas a confirmación.
• Evidencia: [`docs/product/model/use-cases/uc-ask-practice-teacher.md#L16-L35`](docs/product/model/use-cases/uc-ask-practice-teacher.md#L16-L35), [`src/drumcoach_app/teacher/analyse.py#L32-L95`](src/drumcoach_app/teacher/analyse.py#L32-L95), [`src/drumcoach_app/assistant/tools.py#L1423-L1508`](src/drumcoach_app/assistant/tools.py#L1423-L1508).

Bounded contexts

| Bounded context | Responsabilidad | Corroboración en código |
|---|---|---|
| Instrument-Specific Ingestion | Adquirir/parsear fuentes y producir revisiones instrumentales | `import_runner.py`, `transcription_adapter.py`, `omr.py` |
| Practice Material | Representar canciones, partes, revisiones y artefactos | `repository.py`, `practice_score.py` |
| Interactive Notation Player | Proyectar notación y reproducción sobre un reloj común | `player.py`, `generated_playback.py`, `viewer/static-alphatab-spike/index.html` |
| Contextual Practice Coaching | Analizar hechos musicales y producir orientación acotada | `teacher/`, `assistant/tools.py` |

Las cuatro fronteras están descritas en [`docs/product/architecture.md#L23-L32`](docs/product/architecture.md#L23-L32) y en los bounded contexts correspondientes.

Reglas de negocio
• `Practice Score` JSON es la representación canónica. MusicXML, MIDI, diagnósticos y engraving son derivados: [`docs/product/model/business-rules/br-score-json-canonical.md#L14-L24`](docs/product/model/business-rules/br-score-json-canonical.md#L14-L24).
• La importación está limitada por familia instrumental. El adapter usa máscaras para batería, piano acústico y guitarra; los perfiles eléctricos son explícitos: [`src/drumcoach_spike/transcription_adapter.py#L18-L36`](src/drumcoach_spike/transcription_adapter.py#L18-L36).
• Los bundles pueden crear jobs hijos bajo una misma canción. La persistencia modela `ImportBundle`, `ImportJob`, `Song`, `InstrumentPart` y revisiones: [`src/drumcoach_app/repository.py#L52-L84`](src/drumcoach_app/repository.py#L52-L84).
• Los artefactos derivados deben ser regenerables. El runner publica score, MusicXML, eventos normalizados, procedencia, diagnósticos y trazas: [`src/drumcoach_app/import_runner.py#L426-L529`](src/drumcoach_app/import_runner.py#L426-L529).
• El coaching es grounded y confirm-first. El análisis y el plan son deterministas; la reproducción propuesta no se ejecuta hasta confirmar la acción: [`src/drumcoach_app/teacher/__init__.py#L1-L19`](src/drumcoach_app/teacher/__init__.py#L1-L19), [`src/drumcoach_app/assistant/tools.py#L1448-L1508`](src/drumcoach_app/assistant/tools.py#L1448-L1508).

Restricciones
• Runtime principal local en macOS, Python `>=3.11`, SQLite y raíces de archivos configurables: [`docs/product/model/requirements/constraints/con-macos-local-runtime.md#L13-L20`](docs/product/model/requirements/constraints/con-macos-local-runtime.md#L13-L20), [`docs/product/model/requirements/constraints/con-local-sqlite.md#L13-L20`](docs/product/model/requirements/constraints/con-local-sqlite.md#L13-L20).
• Las transcripciones de audio están limitadas a diez minutos: [`src/drumcoach_spike/audio_duration.py#L10-L11`](src/drumcoach_spike/audio_duration.py#L54-L69).
• Las imágenes de partitura tienen límite de 25 MB y sólo PNG, JPEG o WebP: [`src/drumcoach_app/main.py#L111-L113`](src/drumcoach_app/main.py#L111-L113), [`src/drumcoach_app/main.py#L930-L944`](src/drumcoach_app/main.py#L930-L944).
• OMR y voz son integraciones opcionales. Su ausencia debe producir un fallo durable o una respuesta `unavailable`, no impedir que arranque la aplicación: [`docs/product/model/requirements/quality/qr-local-availability.md#L17-L22`](docs/product/model/requirements/quality/qr-local-availability.md#L17-L22).
• La reproducción generada se deriva del score activo y conserva duraciones explícitas para instrumentos melódicos: [`src/drumcoach_app/generated_playback.py#L47-L57`](src/drumcoach_app/generated_playback.py#L123-L205).

Vista confirmada

Inferencias
• El valor central no es “transcribir audio” aislado, sino cerrar el ciclo fuente → material instrumental → práctica sincronizada.
• La arquitectura distingue correctamente identidad/lifecycle en SQLite de contenido musical y evidencia en archivos.
• Coaching, voz, OMR y engraving están implementados como capacidades acotadas alrededor del flujo principal, no como fuentes alternativas de verdad.

Incógnitas y contradicciones observadas

1. MIDI no tiene un contrato único. La arquitectura lo presenta como fuente primaria, pero `SUPPORTED_IMPORT_SOURCE_KINDS` no incluye `midi`; `/midi-import` está documentado en código como exploración no canónica: [`docs/product/architecture.md#L34-L38`](docs/product/architecture.md#L34-L38), [`src/drumcoach_app/main.py#L99-L112`](src/drumcoach_app/main.py#L99-L112), [`src/drumcoach_app/main.py#L505-L510`](src/drumcoach_app/main.py#L505-L510).

2. El runtime OMR por defecto no está descrito de forma uniforme. La arquitectura menciona `drumcoach-homr`, mientras que el adapter de código usa Audiveris si no existe `DRUMCOACH_OMR_COMMAND`; la documentación detallada condiciona HOMR a la existencia del entorno PianoLesson: [`docs/product/architecture.md#L36-L38`](docs/product/architecture.md#L36-L38), [`src/drumcoach_spike/omr.py#L105-L114`](src/drumcoach_spike/omr.py#L105-L114), [`docs/score-image-import.md#L8-L41`](docs/score-image-import.md#L8-L41).

3. El nivel de compromiso de algunas capacidades no está totalmente resuelto. `docs/product` se presenta como baseline aceptada, pero varios elementos siguen marcados `draft` y la arquitectura clasifica coaching, voz y flujos multiinstrumento como experimentales u opt-in: [`docs/product/README.md#L3-L15`](docs/product/README.md#L3-L15), [`docs/product/architecture.md#L7-L9`](docs/product/architecture.md#L7-L9), [`docs/product/model/domain/bounded-contexts/bc-practice-coaching.md#L1-L10`](docs/product/model/domain/bounded-contexts/bc-practice-coaching.md#L1-L10).

Siguiente decisión única: fijar el estatus de MIDI en el producto. La opción segura es declararlo explícitamente como exploración no canónica y alinear `architecture.md` y el brief; sólo conviene convertirlo en fuente canónica si se decide añadir un `source_kind` y un flujo de importación con el mismo contrato de procedencia y revisión que el resto.
Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.
