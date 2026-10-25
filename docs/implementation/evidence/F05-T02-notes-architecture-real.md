✦
OMP
ARCHITECTURE — draft

Objetivo actual: describir la arquitectura real de `src/drumcoach_app`, `src/drumcoach_spike` y sus contratos de prueba, limitándome a componentes, entradas, salidas, persistencia y relaciones confirmadas en el código.

Confianza: alta en las relaciones implementadas; `medium` en la fotografía global porque parte de `tests/test_app.py` referencia rutas que no aparecen en la superficie FastAPI actual.

Hallazgos

1. `main.py` es el composition root HTTP

Hecho observado. `create_app()` configura FastAPI, las rutas, las rutas de artefactos, la base SQLite, los adaptadores de voz y opcionalmente el worker de importación.
• Entradas:
• JSON de importación.
• cargas binarias de audio e imágenes.
• comandos de reproductor y asistente.
• solicitudes de artefactos.
• Salidas:
• JSON de estado y dominio.
• `FileResponse` para HTML, MusicXML, MIDI, PDF y audio.
• respuestas del asistente.
• Relaciones:
• llama a `DrumCoachRepository`.
• delega ejecución a `import_runner`.
• delega reproducción a `PlayerController`.
• conecta voz a `/assistant/turn`, sin acceso directo de STT/TTS a LFM o player.

Evidencia: `src/drumcoach_app/main.py:139-151`, `src/drumcoach_app/main.py:290-315`, `src/drumcoach_app/main.py:626-779`, `src/drumcoach_app/main.py:870-1505`.

2. La persistencia está dividida entre SQLite y un árbol de artefactos

Hecho observado. `DrumCoachRepository` mantiene metadatos y relaciones en SQLite. Los contenidos pesados y derivados se guardan como archivos relativos bajo `artifact_root`.

SQLite contiene:
• `songs`.
• `midi_explorations`.
• `instrument_parts`.
• `practice_score_revisions`.
• `import_bundles`.
• `import_jobs`.

Relaciones confirmadas:
• una canción tiene partes instrumentales;
• una parte tiene revisiones;
• una parte mantiene una revisión activa;
• un bundle agrupa trabajos hijos;
• un trabajo puede enlazar canción, parte y revisión.

El repositorio también controla transiciones de estado, cancelación cooperativa, reintentos y seguridad de rutas de artefactos.

Evidencia: `src/drumcoach_app/repository.py:178-256`, `src/drumcoach_app/repository.py:380-430`, `src/drumcoach_app/repository.py:627-675`, `src/drumcoach_app/repository.py:801-1017`.

3. La ingestión tiene dos entradas operativas y un runner común

Hecho observado.

Entradas:
• worker en proceso iniciado por `create_app(..., background_import_worker=True)`;
• CLIs `import_cli.py`, `queue_drain_cli.py` y `local_worker_cli.py`.

Ambas rutas terminan en `import_runner.py`, que procesa:
• `raw_events`;
• `local_audio`;
• `youtube_url`;
• `score_image`.

El worker:

1. obtiene el siguiente job `queued`;
2. lo reclama atómicamente como `running`;
3. selecciona el runner según `source_kind`;
4. persiste `succeeded`, `failed` o `cancelled`.

Salidas de un job completado:
• `practice-score.json`;
• `raw-events.jsonl`;
• `normalized-events.json`;
• `source-provenance.json`;
• `conversion-summary.json`;
• `note-trace.json`;
• `practice-score.musicxml`;
• diagnósticos adicionales;
• revisión y enlaces de dominio en SQLite.

Evidencia: `src/drumcoach_app/main.py:185-287`, `src/drumcoach_app/queue_drain_cli.py:9-18`, `src/drumcoach_app/local_worker_cli.py:14-55`, `src/drumcoach_app/import_runner.py:192-285`, `src/drumcoach_app/import_runner.py:319-401`, `src/drumcoach_app/import_runner.py:426-594`.

Las pruebas confirman la cadena de dominio y sus fallos principales: `tests/test_import_runner.py:19-82`, `tests/test_import_runner.py:176-203`, `tests/test_import_runner.py:333-411`, `tests/test_repository.py:68-101`.

4. `drumcoach_spike` contiene el modelo canónico y las proyecciones de notación

Hecho observado.

`models.py` define:
• eventos de origen;
• golpes de batería;
• notas con duración;
• compases;
• grupos armónicos;
• `PracticeScore`.

`practice_score.py` transforma eventos preservados en una `PracticeScore` instrumental:
• batería: schema 1 con `hits`;
• teclado/guitarra: schema 2 con notas, duración y provenance;
• eventos incompatibles: `unsupported_events`.

`transcription_pipeline.py` expone la API pública para audio local. Su entrada es un WAV más configuración y un adaptador opcional; su salida es `DrumTranscriptionResult` con score, eventos raw, eventos normalizados, diagnósticos, provenance, configuración, métricas opcionales y MusicXML opcional.

La API pública de `transcription_pipeline.py` valida actualmente `instrument="drums"`; el soporte interno de teclado y guitarra se ejecuta mediante `build_practice_score` desde la ruta de aplicación.

Evidencia: `src/drumcoach_spike/models.py:63-170`, `src/drumcoach_spike/practice_score.py:99-250`, `src/drumcoach_spike/transcription_pipeline.py:87-150`, `src/drumcoach_spike/transcription_pipeline.py:168-287`.

El writer publica el bundle de forma atómica: `src/drumcoach_spike/transcription_pipeline.py:290-364`.

Pruebas: `tests/test_transcription_pipeline.py:42-68`, `tests/test_transcription_pipeline.py:128-162`.

5. La reproducción lee la revisión activa y usa un timeline común

Hecho observado.

`PlayerController` recibe un repositorio, `artifact_root` y un `state_store`. Al abrir una canción:

1. resuelve la parte instrumental activa mediante el repositorio;
2. carga el `practice-score.json`;
3. construye `TimelineEngine`;
4. crea un `PlayerSession`.

`TimelineEngine` es el componente que convierte compases y cambios de tempo en:
• ticks;
• segundos musicales;
• segundos de audio;
• rangos de práctica half-open.

`generated_playback.py` lee el Practice Score y produce el payload consumido por el navegador. `quantized_midi.py` genera MIDI desde ese mismo payload. `musescore_engraver.py` puede convertir la salida cuantizada en MusicXML/PDF; si MuseScore no está disponible, el runner conserva la proyección MusicXML de la aplicación.

El asistente y el profesor reutilizan esta misma cadena:
• `assistant/tools.py` sólo ejecuta capacidades registradas;
• `teacher/analyse.py` lee score activo, timeline y sidecars;
• `assistant/session.py` persiste estado de conversación, player y práctica en `.local/assistant`.

Evidencia: `src/drumcoach_app/player.py:316-386`, `src/drumcoach_app/player.py:412-564`, `src/drumcoach_app/timeline.py:1-179`, `src/drumcoach_app/generated_playback.py:47-103`, `src/drumcoach_app/quantized_midi.py:1-44`, `src/drumcoach_app/musescore_engraver.py:1-14`, `src/drumcoach_app/assistant/tools.py:1-6`, `src/drumcoach_app/teacher/analyse.py:32-95`, `src/drumcoach_app/assistant/session.py:123-158`.

Pruebas: `tests/test_player.py:45-129`, `tests/test_player.py:178-252`, `tests/test_generated_playback.py:1-6`, `tests/test_engraving_flow.py:356-445`.

6. Existe una divergencia entre la superficie runtime y parte de los contratos de tests

Hecho observado. La enumeración runtime de `create_app()` devuelve 59 rutas y contiene, entre otras, `/viewer/static-library/`, `/viewer/static-alphatab/`, `/viewer/score-image-import/`, `/viewer/static-tab/` y `/viewer/drums2/`.

`tests/test_app.py` todavía referencia rutas como:
• `/viewer/midi-import/`;
• `/viewer/static-import/`;
• `/viewer/drum-midi-grid/`;
• `/viewer/drum-alphatab/`;
• `/viewer/static-osmd/`.

Esto indica un contrato de tests desalineado, una migración incompleta o superficies retiradas que aún se consideran parte del sistema de pruebas. No infiero cuál de las dos fuentes debe prevalecer.

Evidencia runtime: `src/drumcoach_app/main.py:571-588`, `src/drumcoach_app/main.py:841-868`, `src/drumcoach_app/main.py:1493-1500`;
evidencia de tests: `tests/test_app.py:94-114`, `tests/test_app.py:172-181`, `tests/test_app.py:273-306`.

Incógnita: el código actual confirma la arquitectura operativa; los tests no permiten afirmar que todas las vistas históricas sigan siendo contratos vigentes.

Siguiente decisión útil: decidir si la arquitectura documentada debe tomar como fuente de verdad la superficie FastAPI actual y retirar/actualizar los contratos de vistas históricas en `tests/test_app.py`.

Entrega arquitectónica completada. Todos los puntos quedaron cubiertos y el único diagrama Mermaid corresponde a la arquitectura runtime confirmada.
Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.
