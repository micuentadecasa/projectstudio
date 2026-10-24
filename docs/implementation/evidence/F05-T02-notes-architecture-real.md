✦
OMP
## Verificación Inspección directa de `src/drumcoach_app`, `src/drumcoach_spike` y tests. Contratos ejecutados: **313 passed**, 1 advertencia deprecada de Starlette/httpx. ## 1. Aplicación HTTP y ejecución de jobs **Componentes** - `src/drumcoach_app/main.py`: crea FastAPI, valida requests, expone rutas y puede iniciar un worker en background. - `src/drumcoach_app/local_worker_cli.py`: worker local que drena cada tipo de fuente secuencialmente. - `src/drumcoach_app/queue_drain_cli.py`: procesa una clase de fuente en una ejecución. - `src/drumcoach_app/import_runner.py`: implementa la ejecución de cada job. **Entradas** - `/imports`: URI, `source_kind`, instrumento/perfil y tamaño de modelo. - `/imports/local-audio`: bytes de audio. - `/imports/score-image`: bytes de imagen. - `/imports/{id}/retry` y `/imports/{id}/cancel`. - CLI con base SQLite, raíz de artefactos y raíz de descargas. **Salidas** - JSON de job o bundle con estado, ids de `Song`, `InstrumentPart` y `PracticeScoreRevision`. - Archivos servidos por rutas `/artifacts/...` y `/instrument-parts/...`. - Estados `queued`, `running`, `succeeded`, `failed` y `cancelled`. **Persistencia y relaciones** El worker consulta jobs en SQLite, reclama uno de forma atómica y delega en el runner correspondiente. La ejecución en background dentro de FastAPI es opcional; el launcher local usa el worker separado. Rutas: `src/drumcoach_app/main.py:205-287,290-315,870-1011,1143-1184`; `src/drumcoach_app/local_worker_cli.py:14-55`; `src/drumcoach_app/queue_drain_cli.py:21-123`. ## 2. Persistencia relacional y archivos de artefactos **Componentes** `DrumCoachRepository` y `initialize_schema` en `src/drumcoach_app/repository.py`. **Entidades persistidas** - `songs` - `instrument_parts` - `practice_score_revisions` - `import_bundles` - `import_jobs` - `midi_explorations` **Relaciones** - Un `Song` tiene múltiples `InstrumentPart`. - Una `InstrumentPart` tiene revisiones y un `active_practice_score_revision_id`. - Un `ImportBundle` agrupa jobs hijos y referencia un Song. - Un `ImportJob` puede referenciar Song, part, revision y bundle. - Una `MidiExploration` referencia un Song y archivos MIDI/DrumScore. **Salidas persistidas fuera de SQLite** Las revisiones guardan rutas relativas a: - `practice-score.json` - `practice-score.musicxml` - `conversion-summary.json` - `raw-events.jsonl` - `normalized-events.json` - `source-provenance.json` - `note-trace.json` - `engraving.json` y outputs de MuseScore cuando corresponde Rutas: `src/drumcoach_app/repository.py:11-88,178-257,380-431,627-741,801-972`; publicación de archivos en `src/drumcoach_app/import_runner.py:461-529`. Tests: `tests/test_repository.py:10-97`; `tests/test_import_runner.py:19-66`. ## 3. Ingesta: fuentes, adquisición y transcripción **Componentes** - `src/drumcoach_spike/source_acquisition.py`: título, thumbnail, búsqueda y descarga vía `yt-dlp`. - `src/drumcoach_spike/transcription_adapter.py`: frontera hacia MuScriptor. - `src/drumcoach_spike/omr.py`: frontera de comando local para OMR. - `src/drumcoach_app/import_runner.py`: coordinación de los caminos. **Entradas y relaciones** - `raw_events`: lee JSONL directamente. - `local_audio`: valida duración, obtiene timing y llama `MuScriptorTranscriptionAdapter.transcribe`. - `youtube_url`: descarga audio local, transforma el job a `local_audio` y luego usa el mismo adapter. - `score_image`: OMR devuelve MusicXML; el runner lo convierte a eventos de piano. - La familia instrumental se convierte en una máscara MuScriptor: batería, teclado o guitarra. **Salidas** Todos los caminos convergen en `_complete_import_job`, que construye el `PracticeScore`, escribe artefactos, crea o reutiliza Song/part y registra una revisión. Rutas: `src/drumcoach_app/import_runner.py:82-110,192-285,319-399,426-590`; `src/drumcoach_spike/transcription_adapter.py:23-43,138-226`; `src/drumcoach_spike/source_acquisition.py:16-170`; `src/drumcoach_spike/omr.py:51-103`. ## 4. Modelos de score y proyecciones de notación Hay dos caminos confirmados: ### Practice Score `build_practice_score` recibe eventos preservados y produce un `PracticeScore` específico de instrumento: - Schema 1 para batería. - Schema 2 para partes pitched. - Eventos de otras familias quedan en `unsupported_events`. - Pitch, timing compacto y provenance permanecen en el score; campos de notación son derivados. `src/drumcoach_spike/practice_score.py:99-125,253-320`; `src/drumcoach_spike/models.py:63-170`. Las proyecciones son: - `src/drumcoach_spike/musicxml.py`: MusicXML para batería, teclado y guitarra; incluye simplificación de piano. - `src/drumcoach_spike/pitched_notation.py`: materiales pitched, armonía, staves y metadatos. - `src/drumcoach_spike/drum_score_musicxml.py`: MusicXML desde `DrumScore`. `src/drumcoach_spike/musicxml.py:53-105,158-235`; `src/drumcoach_spike/drum_score_musicxml.py:12-145`. ### Explorador MIDI de batería `POST /midi-import` es un camino separado: 1. Audio temporal. 2. MuScriptor devuelve MIDI nativo. 3. Se guarda `.mid`. 4. `drum_score_from_midi_file` produce `DrumScore`. 5. `practice_score_from_drum_midi` produce una proyección `PracticeScore` para APIs existentes. 6. Se persisten `MidiExploration`, `DrumScore` JSON, JSON de proyección y MusicXML. El `DrumScore` es la fuente de la rama nativa MIDI; el Practice Score es una proyección de compatibilidad para esta rama. Rutas: `src/drumcoach_app/main.py:505-569`; `src/drumcoach_spike/drum_score.py:17-113`; `src/drumcoach_spike/midi_drum_score.py:11-54`. Tests: `tests/test_midi_drum_score.py:8-23`; `tests/test_drum_score.py:23-143`. ## 5. Player y playback generado **Componentes** - `src/drumcoach_app/player.py`: `PlayerController` y adapters de batería, piano y guitarra. - `src/drumcoach_app/timeline.py`: resolución de compases y score time. - `src/drumcoach_app/generated_playback.py`: payload de notas reproducibles. - `main.py`: endpoints de score, MusicXML, playback y audio original. **Entradas** - `song_id` e instrumento. - `InstrumentPart` con revisión activa. - `practice-score.json` y sidecars. - Comandos de apertura, selección, transporte, tempo, loop, metrónomo y fuente de playback. **Salidas** - Estado de sesión del player. - URLs de MusicXML y generated playback. - Payload de notas con tick, duración, segundos, pitch, canal, programa, voz y provenance. - Audio original retenido cuando existe. **Persistencia** `PlayerController` guarda la sesión y eventos en el `state_store`; no crea un modelo de player separado en SQLite. El assistant persiste su contexto en `.local/assistant/sessions/*.json`. Rutas: `src/drumcoach_app/player.py:265-410,412-564`; `src/drumcoach_app/generated_playback.py:47-130,242-299`; `src/drumcoach_app/main.py:1308-1470`; `src/drumcoach_app/assistant/session.py:46-59,127-158`. Tests: `tests/test_player.py:45-155`; `tests/test_generated_playback.py:50-216`. ## 6. Teacher, assistant y voz **Teacher** `SelectionAnalyser` obtiene el estado del `PlayerController`, carga la revisión activa desde los artefactos, recoge eventos del rango y produce `SelectionAnalysis`. Luego delega por instrumento a análisis de batería o pitched. Entrada: canción, instrumento y rango de compases. Salida: métrica, eventos, patrones, armonía, técnica, dificultad, evidencia e incertidumbres. Persistencia: cache en memoria limitada; el score y sidecars permanecen en artefactos. Rutas: `src/drumcoach_app/teacher/analyse.py:32-126`; `src/drumcoach_app/teacher/score_events.py:28-53`; `src/drumcoach_app/teacher/cache.py:19-54`. **Assistant** `AssistantOrchestrator` recibe texto o transcripción, carga una sesión local, expone el registro de tools, ejecuta llamadas validadas y devuelve `TurnOutcome` con respuesta, llamadas y acciones UI. Relación confirmada: los tools reciben un `ToolExecutionContext`; el modelo no accede directamente a SQLite, archivos ni rutas. Las acciones del player se aplican mediante el mismo `PlayerController`. Rutas: `src/drumcoach_app/assistant/orchestrator.py:207-333,450-502`; `src/drumcoach_app/assistant/tools.py:1-6,48-84,113-160`; `src/drumcoach_app/main.py:626-779`. **Voz** Los endpoints `/voice/transcribe` y `/voice/speak` usan servicios locales STT/TTS. `voice/actions.py` valida envelopes, normaliza argumentos, rechaza acciones no comprometidas y evita duplicados. Rutas: `src/drumcoach_app/main.py:325-423`; `src/drumcoach_app/voice/actions.py:41-208`; tests en `tests/test_voice.py:11-103`. ```mermaid flowchart LR Client[Viewer HTTP o TestClient] --> App[main.py FastAPI] App --> Repo[DrumCoachRepository] Repo --> DB[(SQLite)] App --> Worker[Worker local<br/>main.py o local_worker_cli] Worker --> Repo Worker --> Runner[import_runner.py] Audio[local_audio o youtube_url] --> App Raw[raw_events JSONL] --> App Image[score_image] --> App Runner --> Acquire[source_acquisition.py] Acquire --> LocalAudio[Audio local retenido] LocalAudio --> Adapter[MuScriptorTranscriptionAdapter] Runner --> Adapter Runner --> OMR[omr.py] Runner --> RawEvents[Eventos normalizados] Adapter --> RawEvents OMR --> RawEvents Raw --> RawEvents RawEvents --> Score[practice_score.py<br/>PracticeScore] Score --> Artifacts[(artifact_root<br/>JSON sidecars MusicXML)] Score --> XML[musicxml.py] XML --> Artifacts Score --> Playback[generated_playback.py] Playback --> App Runner --> Repo App --> Library[Library y active revision] Library --> Player[player.py<br/>PlayerController] Repo --> Player Artifacts --> Player Player --> Timeline[timeline.py] Player --> Playback App --> MidiExplorer[/midi-import] MidiExplorer --> Adapter MidiExplorer --> MidiFile[MIDI exploración] MidiFile --> DrumScore[drum_score.py<br/>DrumScore] MidiFile --> MidiProjection[midi_drum_score.py<br/>PracticeScore projection] DrumScore --> Artifacts MidiProjection --> Repo Player --> Teacher[teacher/analyse.py] Teacher --> ScoreEvents[teacher/score_events.py] ScoreEvents --> Artifacts Teacher --> Assistant[assistant/orchestrator.py<br/>assistant/tools.py] Assistant --> Player Voice[voice STT/TTS y actions] --> App ```
Viewer HTTP o TestClient
Client
→
main.py FastAPI
App
→
DrumCoachRepository
Repo
→
(SQLite)
DB
→
Worker local<br/>main.py o local_worker_cli
Worker
→
import_runner.py
Runner
→
local_audio o youtube_url
Audio
→
raw_events JSONL
Raw
→
score_image
Image
→
source_acquisition.py
Acquire
→
Audio local retenido
LocalAudio
→
MuScriptorTranscriptionAdapter
Adapter
→
omr.py
OMR
→
Eventos normalizados
RawEvents
→
practice_score.py<br/>PracticeScore
Score
→
(artifact_root<br/>JSON sidecars MusicXML)
Artifacts
→
musicxml.py
XML
→
generated_playback.py
Playback
→
Library y active revision
Library
→
player.py<br/>PlayerController
Player
→
timeline.py
Timeline
→
/midi-import
MidiExplorer
→
MIDI exploración
MidiFile
→
drum_score.py<br/>DrumScore
DrumScore
→
midi_drum_score.py<br/>PracticeScore projection
MidiProjection
→
teacher/analyse.py
Teacher
→
teacher/score_events.py
ScoreEvents
→
assistant/orchestrator.py<br/>assistant/tools.py
Assistant
→
voice STT/TTS y actions
Voice
Generado por OMP · basado en el bloque Mermaid recibido
