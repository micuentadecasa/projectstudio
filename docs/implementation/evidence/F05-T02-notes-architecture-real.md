✦
OMP
Objetivo actual

Documentar la arquitectura implementada de DrumCoach/Notes a partir únicamente de relaciones observables en `src/drumcoach_app`, `src/drumcoach_spike` y sus tests. No se infieren microservicios, buses, colas externas ni componentes no presentes en el código.

Hallazgo 1 — `main.py` es el borde de aplicación y configura el runtime local

Hecho. `create_app()` construye una aplicación FastAPI, inicializa SQLite cuando recibe `database_path`, registra las rutas HTTP y conserva en `app.state` las rutas de base de datos, artefactos y fuentes importadas. También conecta los adaptadores de voz. `src/drumcoach_app/main.py:290-315`.

Entradas:
• Peticiones HTTP para imports, biblioteca, player, assistant, voz y exploración MIDI.
• Configuración por argumentos o entorno.
• Uploads de audio/imágenes y payloads JSON.

Salidas:
• Respuestas JSON, archivos MusicXML/MIDI/PDF y páginas estáticas.
• Estados de jobs, canciones, partes y player.

Persistencia y relación:
• Delega metadatos a `DrumCoachRepository`.
• Delega artefactos al `artifact_root`.
• Puede arrancar un worker local en segundo plano, pero sólo cuando `background_import_worker=True`: `src/drumcoach_app/main.py:283-315`.
• Los tests verifican configuración, rutas primarias y health check: `tests/test_app.py:18-90,172-190`.

Hallazgo 2 — `repository.py` define la persistencia SQLite y los enlaces de dominio

Hecho. La persistencia local contiene tablas para `songs`, `instrument_parts`, `practice_score_revisions`, `import_bundles`, `import_jobs` y `midi_explorations`. Las relaciones usan claves foráneas SQLite: `src/drumcoach_app/repository.py:178-258`.

Relaciones confirmadas:
• Una `Song` tiene varias `InstrumentPart`.
• Una `InstrumentPart` puede apuntar a una revisión activa.
• Una `PracticeScoreRevision` pertenece a una `InstrumentPart` y conserva rutas relativas a artefactos.
• Un `ImportBundle` agrupa jobs hijos y puede asociarse a una canción.
• Un `ImportJob` puede enlazar canción, parte, revisión y bundle.
• Una `MidiExploration` pertenece a una canción y apunta a un MIDI y a un `DrumScore`.

Los tests confirman la cadena `Song → InstrumentPart → PracticeScoreRevision` y las transiciones de estado de jobs: `tests/test_repository.py:10-37,68-127`; `tests/test_import_runner.py:19-66`.

Restricción observada. Las rutas de artefactos se validan como relativas; no se aceptan rutas absolutas o escapadas: `tests/test_repository.py:40-65`.

Hallazgo 3 — El worker selecciona un runner según `source_kind`

Hecho. `_import_worker_loop()` consume un job en estado queued, lo procesa uno por vez y selecciona el runner por tipo de fuente: `score_image`, `youtube_url`, `local_audio` o `raw_events`. `src/drumcoach_app/main.py:205-280`.

Relaciones confirmadas:

```text
ImportJob
  → Import runner
  → TranscriptionAdapter u OMR
  → Practice Score
  → artefactos
  → Song / InstrumentPart / PracticeScoreRevision
```
• Audio local: `run_local_audio_import_job()` valida duración, obtiene timing, invoca `adapter.transcribe()` y completa el job: `src/drumcoach_app/import_runner.py:192-235`.
• URL: `run_youtube_import_job()` descarga el audio, retiene la fuente local y sigue el mismo pipeline: `src/drumcoach_app/import_runner.py:319-394`.
• Eventos crudos: el runner lee JSONL y entra directamente en la conversión.
• La transcripción se mantiene detrás de `TranscriptionAdapter`: `src/drumcoach_app/import_runner.py:73-79`.

Los tests confirman que el adapter recibe el path y el instrumento solicitado, y que el job termina enlazado a canción, parte y revisión: `tests/test_import_runner.py:69-115`.

Hallazgo 4 — `Practice Score` es el centro de conversión y las salidas son proyecciones

Hecho. `build_practice_score()` recibe eventos crudos, BPM, offset, firma temporal, instrumento y perfil; produce un `PracticeScore` específico de batería, teclado o guitarra. `src/drumcoach_spike/practice_score.py:99-120`.

Procesamiento confirmado:
• Eventos compatibles se convierten en hits de batería o notas pitched.
• Eventos fuera del perfil permanecen en `unsupported_events`.
• Las notas pitched conservan duración, pitch, provenance y ties.
• La salida se serializa como JSON versionado: `src/drumcoach_spike/practice_score.py:139-185,187-250`.

`practice_score_to_musicxml()` consume ese score y genera MusicXML para batería, teclado o guitarra: `src/drumcoach_spike/musicxml.py:88-148`.

Durante la finalización del job se escriben:
• `raw-events.jsonl`
• `practice-score.json`
• `practice-score.musicxml`
• `conversion-summary.json`
• `normalized-events.json`
• `source-provenance.json`
• `note-trace.json`

Evidencia: `src/drumcoach_app/import_runner.py:426-529`; contrato probado en `tests/test_import_runner.py:19-66`.

Hallazgo 5 — Playback y navegación musical leen el score, no el audio crudo

Hecho. `build_generated_playback_payload()` carga `practice-score.json`, reconstruye límites de compás mediante `TimelineEngine` y produce notas, eventos temporales, límites de medidas, BPM, offset y metadatos de SoundFont. `src/drumcoach_app/generated_playback.py:47-103,123-133`.

Relaciones confirmadas:
• El score define la posición musical.
• Los sidecars raw/normalized pueden aportar pitch y datos de provenance.
• Batería usa canal MIDI 9; teclado y guitarra usan canales/programas pitched: `src/drumcoach_app/generated_playback.py:14-39,53-58`.
• `TimelineEngine` convierte medidas a ticks, segundos musicales y segundos de audio sin modificar el score: `src/drumcoach_app/timeline.py:1-5,17-64`.
• `PlayerController` resuelve una canción y una revisión activa mediante `DrumCoachRepository`, y mantiene el estado de sesión en un `state_store`: `src/drumcoach_app/player.py:265-322,316-410`.

Los tests prueban cambio de instrumento manteniendo la misma sesión, rango, loop y tempo: `tests/test_player.py:45-69`; también prueban que playback conserva duración, canales, offsets y límites de compás: `tests/test_generated_playback.py:50-68,121-153`.

Rama separada confirmada. `/midi-import` es un explorador MIDI independiente del flujo de `ImportJob`; genera MIDI nativo de MuScriptor y, si hay base de datos, persiste además `MidiExploration` y artefactos de `DrumScore`: `src/drumcoach_app/main.py:505-569`. No debe representarse como equivalente al pipeline canónico de `Practice Score`.

Hallazgo 6 — Assistant y teacher reutilizan el mismo `PlayerController`

Hecho. `/assistant/turn` entrega el mensaje al `AssistantOrchestrator`, que usa un proveedor local y un registro tipado de tools: `src/drumcoach_app/main.py:626-667`; `src/drumcoach_app/assistant/orchestrator.py:1-8,218-220`; `src/drumcoach_app/assistant/tools.py:1-6,24-68`.

Relaciones confirmadas:
• Las tools reciben repositorio, conexión, sesión y configuración; el modelo no accede directamente a SQLite, archivos o rutas: `src/drumcoach_app/assistant/tools.py:48-56`.
• Las acciones manuales de `/assistant/player-command` llaman al mismo `PlayerController` que las tools: `src/drumcoach_app/main.py:718-779`.
• `SelectionAnalyser` obtiene la selección autorizada, carga el score activo, proyecta eventos y ejecuta análisis rítmico e instrumental: `src/drumcoach_app/teacher/analyse.py:1-6,32-95`.
• La sesión assistant persiste estado de player, plan pedagógico y acciones pendientes como JSON bajo `.local/assistant/sessions`: `src/drumcoach_app/assistant/session.py:14-16,34-59,127-158`.
• El test end-to-end confirma: abrir canción → pedir rango → analizar → crear plan → proponer playback → confirmar playback: `tests/test_teacher_assistant.py:55-113`.

Incógnita acotada. El código confirma la integración y sus persistencias, pero no permite afirmar que exista un proceso separado para el modelo local; el proveedor se trata como dependencia del orchestrator.

Siguiente decisión útil: ¿se adopta esta vista como baseline arquitectónico y se documenta después el contrato de cada frontera —API, import runner, repository, player y assistant— sin añadir componentes nuevos?
Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.
