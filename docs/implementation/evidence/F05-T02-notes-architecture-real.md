✦
OMP
## Hallazgos verificables 1. **Frontera de aplicación.** `create_app` construye FastAPI, configura SQLite, raíces de artefactos/fuentes, servicios de voz y opcionalmente inicia el worker en segundo plano: `src/drumcoach_app/main.py:25-62,290-315`. Recibe HTTP para imports, biblioteca, reproducción, voz, asistente y exploración MIDI; devuelve JSON, archivos estáticos, MusicXML, MIDI y artefactos: `src/drumcoach_app/main.py:317-569,870-1495`. 2. **Persistencia y modelo relacional.** `DrumCoachRepository` persiste en SQLite `songs`, `instrument_parts`, `practice_score_revisions`, `import_bundles`, `import_jobs` y `midi_explorations`; los ficheros permanecen bajo raíces configurables y la base guarda rutas relativas: `src/drumcoach_app/repository.py:178-257,330-431,627-741`. La cadena confirmada es `Song → InstrumentPart → PracticeScoreRevision`; un bundle crea un `Song` y jobs independientes por instrumento: `tests/test_repository.py:10-38`; `tests/test_instruments_phase_one.py:18-45,75-105`. 3. **Ingesta y ejecución de jobs.** El worker reclama un job `queued`, recupera jobs `running` tras reinicio y deriva por `raw_events`, `local_audio`, `youtube_url` o `score_image`: `src/drumcoach_app/main.py:185-280`. `import_runner.py` recibe la conexión SQLite, el id del job, fuentes locales o adquiridas y un adaptador; produce estado `succeeded`/`failed`, enlaces de dominio y artefactos: `src/drumcoach_app/import_runner.py:82-115,192-285,319-402,426-594`. MuScriptor está aislado detrás de `MuScriptorTranscriptionAdapter`; OMR y adquisición YouTube son seams separados: `src/drumcoach_spike/transcription_adapter.py:18-45,138-205`; `src/drumcoach_spike/omr.py:1-7,24-64`; `src/drumcoach_spike/source_acquisition.py:80-105`. 4. **Transformación canónica y salidas derivadas.** El pipeline público recibe un WAV, configuración, BPM opcional y un adaptador; devuelve eventos raw/normalizados, `Practice Score`, diagnósticos, provenance, configuración, métricas opcionales y MusicXML: `src/drumcoach_spike/transcription_pipeline.py:43-150,193-287`. La escritura publica sidecars atómicamente —`raw-events.jsonl`, `normalized-events.json`, `practice-score.json`, diagnósticos, configuración, provenance, `note-trace.json` y MusicXML—: `src/drumcoach_spike/transcription_pipeline.py:290-363`. La conversión de aplicación admite las familias instrumentales y separa eventos no pertenecientes a la familia solicitada: `src/drumcoach_spike/practice_score.py:99-183`; `tests/test_import_runner.py:19-65,82-115`. 5. **Consumo, práctica y rama MIDI paralela.** `PlayerController` lee la revisión activa desde SQLite y el `practice-score.json` desde artefactos; mantiene sesión, rango, loop, tempo, metrónomo, fuente de audio y estado de reproducción: `src/drumcoach_app/player.py:316-427,447-564`. `generated_playback.py` y `quantized_midi.py` derivan el payload de reproducción y el MIDI desde el mismo score: `src/drumcoach_app/generated_playback.py:47-69,123-223`; `src/drumcoach_app/quantized_midi.py:27-44`. El teacher lee el score activo, analiza el rango y pasa por `PlayerController`; el asistente persiste sesiones en `.local/assistant/sessions`: `src/drumcoach_app/teacher/score_events.py:1-51`; `src/drumcoach_app/teacher/analyse.py:39-95`; `src/drumcoach_app/assistant/session.py:1-16,123-158`. `/midi-import` es una rama separada: obtiene MIDI nativo de MuScriptor, persiste `DrumScore` como modelo de esa exploración y genera una proyección Practice Score/MusicXML para compatibilidad: `src/drumcoach_app/main.py:505-569`; `src/drumcoach_spike/drum_score.py:81-151,178-223`. ## Decisiones - Mantener explícitamente dos ramas: **imports canónicos mediante `PracticeScore`** y **exploración MIDI mediante `DrumScore`**. - Mantener SQLite como registro de jobs, entidades y rutas; los contenidos musicales permanecen en ficheros de artefactos. - Pregunta única: **¿Debe consolidarse la rama MIDI exploratoria con la cadena canónica?** Opción segura: mantenerla separada hasta definir un contrato de migración y compatibilidad. ## Riesgos - Dos modelos de score persisten material relacionado; una integración futura podría confundir cuál es la fuente de verdad. - La sesión de player/asistente se almacena en estado JSON local, no en SQLite: `src/drumcoach_app/assistant/session.py:34-59,127-158`. - La verificación ejecutada pasó **62 tests** de repositorio, imports, bundles, player y playback; `tests/test_teacher_tools.py` no pudo recopilarse porque `from tests import _teacher_fixture` produce `ModuleNotFoundError: No module named 'tests'`. ## Próximos pasos 1. Documentar contratos de cada frontera: API → job, job → runner, runner → score/artefactos y score → player/teacher. 2. Resolver la separación formal entre `PracticeScore` y `DrumScore`, incluyendo qué revisiones puede abrir el player. 3. Corregir la importación de fixtures de `tests/test_teacher_tools.py` y ejecutar de nuevo ese contrato antes de considerar verificado el flujo teacher-asistente. ```mermaid flowchart LR API[FastAPI create_app<br/>HTTP routes] WORKER[Import worker<br/>local_worker_cli / queue_drain_cli] REPO[DrumCoachRepository] DB[(SQLite)] FILES[(Artifact root<br/>source root)] RUNNER[import_runner.py] ADAPTER[MuScriptorTranscriptionAdapter] OMR[CommandScoreImageOmr] ACQ[source_acquisition<br/>yt-dlp] SCORE[Practice Score builder<br/>practice_score.py] DERIVED[MusicXML · playback payload<br/>quantized MIDI · diagnostics] PLAYER[PlayerController<br/>TimelineEngine] TEACHER[SelectionAnalyser<br/>teacher modules] ASSISTANT[AssistantOrchestrator<br/>typed tools] SESSIONS[(.local/assistant/sessions)] MIDI[MIDI explorer<br/>POST /midi-import] NATIVE[MuScriptor native MIDI] DRUM[DrumScore<br/>drum_score.py] LEGACY[Practice Score/MusicXML<br/>compatibility projection] API --> REPO API --> WORKER WORKER --> REPO WORKER --> RUNNER RUNNER -.-> ADAPTER RUNNER -.-> OMR RUNNER -.-> ACQ RUNNER --> SCORE RUNNER --> DERIVED RUNNER --> REPO REPO --> DB REPO --> FILES SCORE --> FILES DERIVED --> FILES API --> PLAYER PLAYER --> REPO PLAYER --> FILES PLAYER --> DERIVED API --> ASSISTANT ASSISTANT --> PLAYER ASSISTANT --> TEACHER ASSISTANT --> SESSIONS TEACHER --> PLAYER TEACHER --> FILES API --> MIDI MIDI --> NATIVE NATIVE --> DRUM DRUM --> FILES DRUM --> LEGACY LEGACY --> REPO ```
FastAPIcreate_app<br/>HTTProutes
API
SelectionAnalyser<br/>teachermodules
TEACHER
Importworker<br/>local_worker_cli/ queue_drain_cli
WORKER
PlayerController<br/>TimelineEngine
PLAYER
AssistantOrchestrator<br/>typedtools
ASSISTANT
MIDI explorer<br/>POST/midi-import
MIDI
DrumCoachRepository
REPO
import_runner.py
RUNNER
(.local/assistant/sessions)
SESSIONS
MuScriptor native MIDI
NATIVE
(SQLite)
DB
(Artifact root<br/>sourceroot)
FILES
MuScriptorTranscriptionAdapter
ADAPTER
CommandScoreImageOmr
OMR
source_acquisition<br/>yt-dlp
ACQ
Practice Scorebuilder<br/>practice_score.py
SCORE
MusicXML · playbackpayload<br/>quantizedMIDI · diagnostics
DERIVED
DrumScore<br/>drum_score.py
DRUM
PracticeScore/MusicXML<br/>compatibilityprojection
LEGACY
Mapa de relaciones · generado por OMP con evidencia del proyecto
