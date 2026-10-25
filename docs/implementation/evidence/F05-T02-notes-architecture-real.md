✦
OMP
Objetivo actual

Describir la arquitectura implementada en `src/drumcoach_app`, `src/drumcoach_spike` y los tests asociados, limitando cada afirmación a entradas, salidas, persistencia y relaciones visibles en el código.

Hechos observados

1. `main.py` es el punto de entrada HTTP y el compositor de runtime

Entrada: configuración de entorno o argumentos explícitos, solicitudes HTTP y archivos locales.

Salidas: respuestas JSON, archivos MusicXML/MIDI/audio, páginas estáticas del viewer y estado de salud.

`create_app` configura rutas, raíces de artefactos, SQLite, servicios opcionales y el worker de importación. Expone endpoints para imports, canciones, partes instrumentales, score activo, MusicXML y playback generado: [`src/drumcoach_app/main.py#L20-L75`](src/drumcoach_app/main.py#L20-L75), [`src/drumcoach_app/main.py#L303-L323`](src/drumcoach_app/main.py#L303-L323), [`src/drumcoach_app/main.py#L870-L1011`](src/drumcoach_app/main.py#L870-L1011), [`src/drumcoach_app/main.py#L1231-L1470`](src/drumcoach_app/main.py#L1231-L1470).

Los tests verifican configuración de base de datos y artefactos, páginas servidas, `/health` y la navegación local: [`tests/test_app.py#L18-L70`](tests/test_app.py#L18-L70), [`tests/test_app.py#L172-L190`](tests/test_app.py#L172-L190).

2. `repository.py` concentra la persistencia relacional y el ciclo de jobs

Entrada: títulos, fuentes, partes instrumentales, revisiones, jobs y bundles.

Persistencia: SQLite con tablas `songs`, `instrument_parts`, `practice_score_revisions`, `import_bundles`, `import_jobs` y `midi_explorations`.

Salida: dataclasses de dominio, estados de job y rutas relativas a artefactos.

El repositorio crea bundles con una canción y jobs hijos por instrumento; las revisiones pertenecen a una `InstrumentPart` y una revisión puede convertirse en la activa: [`src/drumcoach_app/repository.py#L188-L256`](src/drumcoach_app/repository.py#L188-L256), [`src/drumcoach_app/repository.py#L380-L431`](src/drumcoach_app/repository.py#L380-L431), [`src/drumcoach_app/repository.py#L627-L741`](src/drumcoach_app/repository.py#L627-L741).

El claim de jobs es transaccional: `queued → running` sólo si el estado sigue siendo `queued`; los bundles se recalculan como `succeeded`, `partial`, `failed`, `cancelled` o `running`: [`src/drumcoach_app/repository.py#L801-L904`](src/drumcoach_app/repository.py#L801-L904), [`src/drumcoach_app/repository.py#L995-L1017`](src/drumcoach_app/repository.py#L995-L1017).

Los tests verifican creación, transición, cancelación, retry, validación de rutas y persistencia de estados: [`tests/test_repository.py#L10-L37`](tests/test_repository.py#L10-L37), [`tests/test_repository.py#L40-L99`](tests/test_repository.py#L40-L99).

3. El worker delega cada fuente a un runner específico

Entradas: jobs persistidos con `source_kind` `raw_events`, `local_audio`, `youtube_url` o `score_image`.

Salidas: jobs completados o fallidos y artefactos de importación.

`_import_worker_loop` recupera jobs `running` obsoletos, toma el siguiente job encolado y delega a `run_raw_events_import_job`, `run_local_audio_import_job`, `run_youtube_import_job` o `run_score_image_import_job`: [`src/drumcoach_app/main.py#L185-L280`](src/drumcoach_app/main.py#L185-L280).

Los runners reciben adaptadores explícitos. Audio local pasa por el protocolo `TranscriptionAdapter`; YouTube adquiere primero una fuente local; score-image pasa por OMR y convierte el MusicXML recibido en eventos de teclado: [`src/drumcoach_app/import_runner.py#L73-L115`](src/drumcoach_app/import_runner.py#L73-L115), [`src/drumcoach_app/import_runner.py#L192-L285`](src/drumcoach_app/import_runner.py#L192-L285), [`src/drumcoach_app/import_runner.py#L319-L400`](src/drumcoach_app/import_runner.py#L319-L400).

Los tests cubren la cadena job → canción → parte → revisión y los fallos durables: [`tests/test_import_runner.py#L19-L66`](tests/test_import_runner.py#L19-L66), [`tests/test_import_runner.py#L82-L143`](tests/test_import_runner.py#L82-L143), [`tests/test_local_worker_cli.py#L1-L66`](tests/test_local_worker_cli.py#L1-L66).

4. `PracticeScore` es la transformación canónica; existe además una ruta MIDI nativa separada

Entradas: eventos crudos con timestamps, pitch, instrumento y ciclos note-on/note-off; también eventos derivados desde OMR o MIDI.

Salidas: `PracticeScore` JSON, MusicXML, eventos normalizados y sidecars.

`build_practice_score` filtra por familia instrumental, conserva eventos no seleccionados como `unsupported_events`, produce schema 1 para batería y schema 2 para instrumentos pitched, y divide duraciones sostenidas en segmentos ligados: [`src/drumcoach_spike/practice_score.py#L99-L250`](src/drumcoach_spike/practice_score.py#L99-L250).

El pipeline directo de audio conserva eventos crudos, normalización, configuración, procedencia, diagnósticos, score, MusicXML y `note-trace.json`, publicándolos mediante reemplazo atómico: [`src/drumcoach_spike/transcription_pipeline.py#L160-L236`](src/drumcoach_spike/transcription_pipeline.py#L160-L236), [`src/drumcoach_spike/transcription_pipeline.py#L290-L364`](src/drumcoach_spike/transcription_pipeline.py#L290-L364).

La ruta `/midi-import` es distinta: genera MIDI nativo, persiste un `MidiExploration` y un `DrumScore`; también escribe una proyección compatible de `PracticeScore` y MusicXML: [`src/drumcoach_app/main.py#L505-L569`](src/drumcoach_app/main.py#L505-L569). Los tests distinguen ambas rutas: [`tests/test_app.py#L94-L164`](tests/test_app.py#L94-L164), [`tests/test_drum_score.py#L103-L147`](tests/test_drum_score.py#L103-L147).

Los tests de eventos pitched verifican emparejamiento de ciclos MIDI, sustain, acordes simultáneos, duraciones no estándar y ties válidos en MusicXML: [`tests/test_pitched_event_lifecycle.py#L22-L118`](tests/test_pitched_event_lifecycle.py#L22-L118).

5. La notación y el playback son proyecciones sobre el score y los artefactos

Entrada: `practice-score.json`, `raw-events.jsonl` y `normalized-events.json`.

Salidas: MusicXML, payload de reproducción con notas/ticks/segundos, timeline por eventos simultáneos y proyecciones de teclado como waterfall.

`main.py` sirve MusicXML desde una revisión activa. Puede usar MusicXML de MuseScore o regenerarlo en memoria desde el `PracticeScore`; el endpoint de playback construye el payload desde el score activo y permite filtrar voces de batería: [`src/drumcoach_app/main.py#L1308-L1362`](src/drumcoach_app/main.py#L1308-L1362), [`src/drumcoach_app/main.py#L1450-L1469`](src/drumcoach_app/main.py#L1450-L1469).

`generated_playback.py` usa el score como reloj común; las duraciones pitched permanecen explícitas y la batería usa canal MIDI 9: [`src/drumcoach_app/generated_playback.py#L47-L75`](src/drumcoach_app/generated_playback.py#L47-L75).

`PlayerController` lee la revisión activa desde SQLite y el score desde la raíz de artefactos. Mantiene en `state_store` la sesión, selección, tempo, bucle, fuente de playback y generación de transporte; no persiste ese estado en las tablas del repositorio: [`src/drumcoach_app/player.py#L316-L386`](src/drumcoach_app/player.py#L316-L386), [`src/drumcoach_app/player.py#L412-L475`](src/drumcoach_app/player.py#L412-L475).

Los tests verifican cambio de instrumento sin perder sesión, selección o loop, validación de rangos y reproducción derivada: [`tests/test_player.py#L45-L114`](tests/test_player.py#L45-L114), [`tests/test_generated_playback.py#L50-L67`](tests/test_generated_playback.py#L50-L67), [`tests/test_generated_playback.py#L121-L183`](tests/test_generated_playback.py#L121-L183).

6. Teacher y assistant se relacionan con el player mediante herramientas validadas

Entrada: score activo, instrumento y rango de compases seleccionado.

Salidas: análisis determinista, plan pedagógico, acciones pendientes y cambios validados en `PlayerController`.

`SelectionAnalyser` vuelve a resolver la selección, carga el score activo, construye eventos y timeline, y genera métrica, patrones, armonía, técnica, dificultad, evidencia e incertidumbres: [`src/drumcoach_app/teacher/analyse.py#L32-L95`](src/drumcoach_app/teacher/analyse.py#L32-L95).

El plan pedagógico sólo referencia hechos del análisis y acciones existentes: [`src/drumcoach_app/teacher/pedagogy.py#L1-L8`](src/drumcoach_app/teacher/pedagogy.py#L1-L8). Las herramientas guardan el plan en la sesión del assistant; `propose_playback` crea una acción pendiente y `confirm_pending_action` valida canción y rango antes de llamar a `PlayerController.play`: [`src/drumcoach_app/assistant/tools.py#L1189-L1218`](src/drumcoach_app/assistant/tools.py#L1189-L1218), [`src/drumcoach_app/assistant/tools.py#L1423-L1508`](src/drumcoach_app/assistant/tools.py#L1423-L1508).

Los tests cubren grounding, selección explícita, planes, confirmación y rechazo cuando cambia la selección: [`tests/test_teacher_tools.py#L89-L116`](tests/test_teacher_tools.py#L89-L116), [`tests/test_teacher_tools.py#L154-L216`](tests/test_teacher_tools.py#L154-L216), [`tests/test_teacher_assistant.py#L55-L113`](tests/test_teacher_assistant.py#L55-L113).

Inferencias mínimas
• Hay dos límites técnicos claros: metadata/lifecycle en SQLite y contenido musical/evidencia en archivos.
• `main.py` coordina; `repository.py` persiste; `import_runner.py` ejecuta; `drumcoach_spike` transforma; `player.py` y `teacher/` consumen revisiones activas.
• La ruta MIDI nativa no comparte exactamente el mismo ciclo de importación que audio, YouTube, raw events y score-image.

Incógnita relevante

No queda demostrado en el código inspeccionado que `DrumScore` y `PracticeScore` deban converger en un único modelo futuro; actualmente coexisten con responsabilidades distintas y una proyección de compatibilidad.

Siguiente decisión útil: mantener esta separación como baseline técnica documentada hasta que exista una decisión explícita de unificación; es la opción reversible y no altera consumidores actuales.
Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.
