✦
OMP
## Hallazgos ### 1. `main.py` es el ensamblador HTTP y el punto de integración de la aplicación **Componente:** `src/drumcoach_app/main.py`. - **Entradas:** configuración de base de datos, raíz de artefactos y fuentes importadas; requests FastAPI para imports, biblioteca, player y assistant. `src/drumcoach_app/main.py:290-315,626-730` - **Salidas:** respuestas JSON, `FileResponse` para score/artifacts y estados de jobs; expone las rutas activas de score y playback. `src/drumcoach_app/main.py:1231-1371` - **Persistencia:** abre conexiones SQLite con commit/rollback y configura `busy_timeout`; inicializa el esquema mediante `initialize_schema`. `src/drumcoach_app/main.py:139-151,290-302` - **Relaciones:** importa `DrumCoachRepository`, `import_runner`, `generated_playback`, `practice_score`, `MuScriptorTranscriptionAdapter`, `PlayerController` y el assistant. El worker in-process de `main.py` selecciona el runner según `source_kind`. `src/drumcoach_app/main.py:25-62,205-262` - **Contrato cubierto:** configuración de paths y base local. `tests/test_app.py:18-57` ### 2. La persistencia operacional es SQLite más artefactos referenciados por ruta **Componente:** `src/drumcoach_app/repository.py`. - **Entradas:** `Song`, `InstrumentPart`, `PracticeScoreRevision`, `ImportBundle` e `ImportJob`; creación y transición de jobs. `src/drumcoach_app/repository.py:188-252,801-855` - **Salidas:** entidades reconstruidas desde SQLite, estados `queued/running/succeeded/failed/cancelled`, errores y referencias a revisiones. `src/drumcoach_app/repository.py:857-972` - **Persistencia:** tablas `songs`, `instrument_parts`, `practice_score_revisions`, `import_bundles`, `import_jobs` y `midi_explorations`; las revisiones guardan rutas relativas a score, MusicXML y summary. `src/drumcoach_app/repository.py:188-250,627-714` - **Relaciones:** un `Song` tiene partes; una parte tiene revisiones y una revisión activa; un job puede enlazar Song, InstrumentPart, revisión y bundle. - **Contratos cubiertos:** dominio generado y artefactos bajo un mismo job. `tests/test_import_runner.py:19-66`; bundles con tres partes y revisiones independientes. `tests/test_instruments_phase_one.py:18-45,89-105` ### 3. El drenaje local enruta cada job al runner correspondiente **Componentes:** `src/drumcoach_app/local_worker_cli.py`, `src/drumcoach_app/queue_drain_cli.py`, `src/drumcoach_app/import_runner.py`. - **Entradas:** una base SQLite, raíz de artefactos, `source_kind`, parámetros de tempo, `download_root` y jobs con estado `queued`. `src/drumcoach_app/queue_drain_cli.py:21-62` - **Salidas:** jobs actualizados a `succeeded`, `failed` o `skipped`; el runner publica la cadena de dominio y artefactos. `src/drumcoach_app/queue_drain_cli.py:63-123` - **Relaciones:** - `raw_events` → `run_raw_events_import_job` - `local_audio` → `run_local_audio_import_job` con `MuScriptorTranscriptionAdapter` - `youtube_url` → adquisición local y runner de audio - `score_image` → `run_score_image_import_job` `src/drumcoach_app/queue_drain_cli.py:9-18,64-106` - `local_worker_cli` ejecuta esos drenajes secuencialmente para los cuatro tipos de fuente. `src/drumcoach_app/local_worker_cli.py:14-55` - **Persistencia y fallos:** el runner reclama el job, captura excepciones y deja el error en SQLite. `src/drumcoach_app/import_runner.py:82-115,192-242` - **Contrato cubierto:** orden de drenaje y continuidad tras fallos. `tests/test_local_worker_cli.py:6-80` ### 4. La conversión produce un Practice Score canónico y sidecars derivados **Componentes:** `src/drumcoach_spike/transcription_adapter.py`, `practice_score.py`, `musicxml.py`, `src/drumcoach_app/import_runner.py`. - **Entradas:** eventos raw, BPM, offset, time signature, familia instrumental y perfil; en audio, un `Path` y un adapter de transcripción. `src/drumcoach_spike/practice_score.py:99-125`; `src/drumcoach_app/import_runner.py:192-235` - **Salidas:** `practice-score.json`, `practice-score.musicxml`, `raw-events.jsonl`, `normalized-events.json`, `conversion-summary.json`, `source-provenance.json`, diagnósticos y `note-trace.json`. `src/drumcoach_app/import_runner.py:442-529` - **Persistencia:** archivos bajo `artifact_root/imports/<job-id>/`; SQLite conserva las rutas de score, MusicXML y summary. `src/drumcoach_app/import_runner.py:461-506,580-594` - **Relaciones:** `raw events → build_practice_score → practice_score_to_musicxml`; el mismo score alimenta `build_generated_playback_payload` y MIDI cuantizado. `src/drumcoach_app/import_runner.py:442-459,515-528`; `src/drumcoach_app/generated_playback.py:47-78`; `src/drumcoach_app/quantized_midi.py:27-44` - El adapter limita la transcripción a máscaras instrumentales y devuelve eventos planos. `src/drumcoach_spike/transcription_adapter.py:18-43,138-198` - **Contratos cubiertos:** cadena de dominio y archivos publicados. `tests/test_import_runner.py:19-66,82-115`; score canónico y MusicXML. `tests/test_spike_pipeline.py:63-89` ### 5. Player, teacher y assistant consumen la revisión activa sin convertirse en otra fuente de score **Componentes:** `src/drumcoach_app/player.py`, `generated_playback.py`, `teacher/`, `assistant/`. - **Entradas del player:** Song, parte instrumental activa, revisión y `practice-score.json`; `PlayerController` recibe repository, `artifact_root` y `state_store`. `src/drumcoach_app/player.py:265-322,355-377` - **Salidas del player:** `ScoreProjection`, estado de sesión, selección de compases, transporte, tempo, loop y eventos. `src/drumcoach_app/player.py:282-305,334-342,429-472` - **Persistencia:** el score se lee desde artefactos; el estado de player y la conversación se guardan en el contexto assistant. Las sesiones se escriben en `.local/assistant/sessions/*.json`. `src/drumcoach_app/assistant/session.py:34-56,123-158` - **Relaciones:** - `teacher.score_events` carga la revisión activa desde repository y artefactos, incluyendo `normalized-events.json`. `src/drumcoach_app/teacher/score_events.py:27-83` - `SelectionAnalyser` usa esa score, `TimelineEngine` y enrichment para producir análisis determinista. `src/drumcoach_app/teacher/analyse.py:32-78` - `assistant.tools` construye `PlayerController`; el assistant no accede directamente al motor de audio o a AlphaTab. `src/drumcoach_app/assistant/tools.py:717-740` - `/assistant/turn` delega en `AssistantOrchestrator`. `src/drumcoach_app/main.py:626-667` - **Contratos cubiertos:** estado compartido del player. `tests/test_player.py:11-42`; análisis grounded y confirmación antes de reproducir. `tests/test_teacher_tools.py:154-228` ### 6. Existe una ruta directa de audio a artefactos fuera de la persistencia de jobs **Componentes:** `src/drumcoach_spike/audio_to_score_cli.py`, `transcription_pipeline.py`. - **Entrada:** WAV local y parámetros de modelo, dispositivo, tempo, offset, MIDI de referencia y directorio de salida. `src/drumcoach_spike/audio_to_score_cli.py:17-49` - **Salida:** `DrumTranscriptionResult` y bundle de archivos publicado atómicamente; no crea Songs, ImportJobs ni revisiones SQLite. `src/drumcoach_spike/transcription_pipeline.py:87-145,290-364` - **Persistencia:** sólo filesystem en el `output_dir`, mediante archivos temporales y `os.replace`. `src/drumcoach_spike/transcription_pipeline.py:347-363` - **Relaciones:** la CLI llama directamente a `transcribe_audio_to_practice_score` y `write_transcription_artifacts`; el flujo no pasa por `main.py`, `queue_drain_cli.py` ni `DrumCoachRepository`. `src/drumcoach_spike/audio_to_score_cli.py:8-14,43-53` - **Contrato cubierto:** publicación del bundle auditable y artefactos de diagnóstico. `tests/test_drum_metric_timeline.py:143-175` ## DIAGRAMA ```mermaid flowchart LR HTTP["FastAPI<br/>src/drumcoach_app/main.py"] WORKER["Local worker<br/>local_worker_cli.py"] DRAIN["Queue drain<br/>queue_drain_cli.py"] REPO["DrumCoachRepository<br/>SQLite"] RUNNER["Import runners<br/>import_runner.py"] ADAPTER["MuScriptorTranscriptionAdapter"] ACQ["YouTube acquisition"] OMR["ScoreImageOmr<br/>OMR command"] SCORE["Practice Score builder<br/>practice_score.py"] XML["MusicXML projection<br/>musicxml.py"] FILES["Artifact root<br/>JSON / JSONL / MusicXML / sidecars"] ENGRAVE["MuseScore engraver<br/>musescore_engraver.py"] DIRECT["audio_to_score_cli.py"] PIPE["transcription_pipeline.py"] PLAY["PlayerController<br/>generated_playback.py"] TEACHER["teacher/*"] ASSIST["assistant/*"] SESSIONS["assistant session JSON"] HTTP --> REPO HTTP --> PLAY HTTP --> ASSIST HTTP -.-> RUNNER WORKER --> DRAIN DRAIN --> REPO DRAIN --> RUNNER RUNNER --> ADAPTER RUNNER --> ACQ RUNNER --> OMR RUNNER --> SCORE RUNNER --> ENGRAVE RUNNER --> FILES RUNNER --> REPO ADAPTER --> SCORE OMR --> SCORE SCORE --> XML SCORE --> FILES ENGRAVE --> FILES DIRECT --> PIPE PIPE --> ADAPTER PIPE --> SCORE PIPE --> XML PIPE --> FILES REPO --> PLAY FILES --> PLAY REPO --> TEACHER FILES --> TEACHER TEACHER --> ASSIST ASSIST --> PLAY ASSIST --> SESSIONS ```
"FastAPI<br/>src/drumcoach_app/main.py"
HTTP
→
"Local worker<br/>local_worker_cli.py"
WORKER
→
"Queue drain<br/>queue_drain_cli.py"
DRAIN
→
"DrumCoachRepository<br/>SQLite"
REPO
→
"Import runners<br/>import_runner.py"
RUNNER
→
"MuScriptorTranscriptionAdapter"
ADAPTER
→
"YouTube acquisition"
ACQ
→
"ScoreImageOmr<br/>OMR command"
OMR
→
"Practice Score builder<br/>practice_score.py"
SCORE
→
"MusicXML projection<br/>musicxml.py"
XML
→
"Artifact root<br/>JSON / JSONL / MusicXML / sidecars"
FILES
→
"MuseScore engraver<br/>musescore_engraver.py"
ENGRAVE
→
"audio_to_score_cli.py"
DIRECT
→
"transcription_pipeline.py"
PIPE
→
"PlayerController<br/>generated_playback.py"
PLAY
→
"teacher/*"
TEACHER
→
"assistant/*"
ASSIST
→
"assistant session JSON"
SESSIONS
Generado por OMP · basado en el bloque Mermaid recibido
