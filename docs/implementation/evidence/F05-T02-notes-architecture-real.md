✦
OMP
## Hallazgos verificables 1. **Aplicación y API local.** `src/drumcoach_app/main.py` construye FastAPI, configura SQLite, `artifact_root` e `imported_source_root`, y expone salud, imports, biblioteca, partes, artefactos, reproductor, assistant y exploración MIDI. Entradas: JSON, uploads, URLs y parámetros HTTP. Salidas: `dict`, `Response` y `FileResponse`. Evidencia: `src/drumcoach_app/main.py:290-323,505-506,626-718,870-1010,1231-1501`; `tests/test_app.py:18-113`. 2. **Persistencia y estado de imports.** `repository.py` mantiene en SQLite `songs`, `instrument_parts`, `practice_score_revisions`, `import_bundles`, `import_jobs` y `midi_explorations`. La base guarda identidad, estados y rutas relativas; los contenidos de score y diagnósticos permanecen en archivos. Los bundles crean un `Song` y jobs hijos por instrumento. Evidencia: `src/drumcoach_app/repository.py:180-255,330-431,627-735,801-1017`; `tests/test_repository.py:10-37`; `tests/test_instruments_phase_one.py:18-45`. 3. **Worker e ingestión.** `local_worker_cli.py` ejecuta ciclos secuenciales para `raw_events`, `youtube_url`, `local_audio` y `score_image`; `queue_drain_cli.py` selecciona el runner correspondiente. `import_runner.py` conecta adquisición, `MuScriptorTranscriptionAdapter`, OMR y publicación. Entradas: eventos JSONL, audio local, URL o imagen. Salida persistida: `Song`, `InstrumentPart`, revisión y estado final del job. Evidencia: `src/drumcoach_app/local_worker_cli.py:14-55`; `src/drumcoach_app/queue_drain_cli.py:9-123`; `src/drumcoach_app/import_runner.py:192-284,319-399,426-594`; `tests/test_import_runner.py:19-115`; `tests/test_score_image_import.py:66-117,174-191`. 4. **Pipeline canónico de notas y artefactos.** `src/drumcoach_spike/practice_score.py` convierte eventos preservados en un score por instrumento: batería en schema 1 y partes tonales en schema 2; los eventos incompatibles quedan en `unsupported_events`. `transcription_pipeline.py` y `_complete_import_job` publican eventos crudos/normalizados, `practice-score.json`, MusicXML, provenance, diagnósticos, note trace y playback derivado. Evidencia: `src/drumcoach_spike/practice_score.py:99-185,187-250`; `src/drumcoach_spike/transcription_pipeline.py:87-125,290-364`; `src/drumcoach_app/import_runner.py:442-529`; `tests/test_instruments_phase_one.py:108-187`. 5. **Práctica, playback y coaching.** `PlayerController` resuelve una revisión activa desde repository y archivos, mantiene `PlayerSession` en el `state_store` inyectado y controla instrumento, rango, tempo, loop y transporte. `generated_playback.py` deriva payloads score-time desde el JSON canónico y sidecars. `teacher/analyse.py` analiza el rango seleccionado; `assistant/tools.py` prepara acciones pendientes y sólo reproduce tras confirmación. Evidencia: `src/drumcoach_app/player.py:316-427,447-498`; `src/drumcoach_app/generated_playback.py:47-78,123-242`; `src/drumcoach_app/teacher/analyse.py:32-95`; `src/drumcoach_app/assistant/tools.py:1255-1508`; `tests/test_player.py:45-126`; `tests/test_teacher_tools.py:154-228`. ## Decisiones - La fuente de verdad arquitectónica es `practice-score.json`; SQLite referencia revisiones y archivos, pero no sustituye el score. - El worker no implementa una cola distribuida: reclama jobs SQLite y ejecuta runners locales secuenciales. - El reproductor no persiste su sesión en las tablas de dominio; usa el `state_store` recibido por `PlayerController`. - La verificación ejecutada cubrió los contratos principales: **227 tests pasaron**, con una advertencia deprecada de `httpx`/`TestClient`. ## Riesgos - Hay varias proyecciones de MusicXML: conversor interno, MuseScore opcional y ruta legacy de batería. `import_runner.py:534-548,680-798` registra fallback, engraving y validación semántica; una documentación futura debe distinguirlos. - FastAPI puede iniciar su worker embebido y también existe `local_worker_cli.py`; el reclamo atómico `queued → running` evita doble ejecución, pero la operación debe elegir un modo principal. - Assistant, teacher, voice, OMR y MuseScore tienen dependencias y límites de disponibilidad que no pertenecen al núcleo SQLite/score. - La exploración MIDI usa tablas y endpoints propios y no equivale al flujo de `ImportJob`; mezclar ambos caminos produciría una arquitectura falsa. ## Próximos pasos 1. Documentar esta vista como arquitectura actual, separando explícitamente **persistencia de dominio**, **archivos de artefactos** y **estado efímero del reproductor**. 2. Decisión única pendiente: **¿assistant/teacher/voice y engraving deben documentarse como núcleo o como capacidades opcionales?** Opción segura: mantener como núcleo `FastAPI + jobs locales + Practice Score + biblioteca + playback`; marcar el resto como extensiones. 3. Si se requiere endurecimiento operativo, probar por separado el worker embebido y el CLI local con jobs concurrentes y verificar la transición SQLite. ```mermaid flowchart LR HTTP["HTTP, uploads y URLs"] APP["FastAPI<br/>src/drumcoach_app/main.py"] VIEW["Viewer estático y endpoints JSON"] DB["SQLite<br/>src/drumcoach_app/repository.py"] JOB["ImportJob / ImportBundle"] WORKER["Worker local<br/>local_worker_cli.py / queue_drain_cli.py"] RUNNER["Runners<br/>src/drumcoach_app/import_runner.py"] ADAPTER["TranscriptionAdapter<br/>MuScriptor"] OMR["OMR opcional<br/>src/drumcoach_spike/omr.py"] SPIKE["Practice Score pipeline<br/>practice_score.py / transcription_pipeline.py"] ART["Artifact root<br/>JSON, MusicXML, diagnostics y trace"] MS["MuseScore 4 opcional<br/>musescore_engraver.py"] MIDI["Exploración MIDI"] PLAYER["PlayerController<br/>player.py"] PLAYBACK["Generated playback<br/>generated_playback.py"] TEACHER["Teacher y assistant tools"] STATE["state_store<br/>PlayerSession"] HTTP --> APP APP --> VIEW VIEW --> APP APP --> DB APP --> JOB APP --> MIDI APP -. worker embebido opcional .-> WORKER WORKER --> JOB JOB --> RUNNER RUNNER -->|audio / URL| ADAPTER RUNNER -->|score image| OMR ADAPTER --> SPIKE OMR --> RUNNER RUNNER --> SPIKE SPIKE --> ART RUNNER --> ART RUNNER --> DB RUNNER -. engraving standalone .-> MS MS --> ART MIDI --> DB MIDI --> ART DB --> PLAYER ART --> PLAYER PLAYER --> STATE APP --> PLAYER APP --> PLAYBACK PLAYBACK --> VIEW APP --> TEACHER TEACHER --> PLAYER TEACHER --> DB TEACHER --> ART
HTTP, uploads y URLs
HTTP
Workerlocal<br/>local_worker_cli.py/ queue_drain_cli.py
WORKER
MuseScore 4opcional<br/>musescore_engraver.py
MS
FastAPI<br/>src/drumcoach_app/main.py
APP
Viewer estático yendpoints JSON
VIEW
SQLite<br/>src/drumcoach_app/repository.py
DB
ImportJob / ImportBundle
JOB
Exploración MIDI
MIDI
Generatedplayback<br/>generated_playback.py
PLAYBACK
Teacher y assistant tools
TEACHER
Runners<br/>src/drumcoach_app/import_runner.py
RUNNER
TranscriptionAdapter<br/>MuScriptor
ADAPTER
OMRopcional<br/>src/drumcoach_spike/omr.py
OMR
Practice Scorepipeline<br/>practice_score.py/
SPIKE
Artifact root<br/>JSON,MusicXML, diagnostics ytrace
ART
PlayerController<br/>player.py
PLAYER
state_store<br/>PlayerSession
STATE
Mapa de relaciones · generado por OMP con evidencia del proyecto
