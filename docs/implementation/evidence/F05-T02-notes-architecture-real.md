✦
OMP
## Resumen 1. **[Hecho] Frontera HTTP:** `src/drumcoach_app/main.py` crea FastAPI, configura SQLite y raíces de artefactos/fuentes, sirve viewer, importaciones, biblioteca, scores, playback, assistant, voz y exploración MIDI. Entradas: HTTP y archivos; salidas: JSON, archivos y HTML. Evidencia: `src/drumcoach_app/main.py:20-62,289-323,626-667,870-918,1231-1458`. 2. **[Hecho] Persistencia dividida:** `DrumCoachRepository` mantiene Songs, Instrument Parts, revisiones, bundles, jobs y exploraciones MIDI en SQLite; los artefactos de score y diagnóstico se guardan como archivos con rutas relativas. Evidencia: `src/drumcoach_app/repository.py:178-327,330-337`; contratos: `tests/test_repository.py:10-388`. 3. **[Hecho] Ingesta local secuencial:** los endpoints crean jobs `raw_events`, `local_audio`, `youtube_url` o `score_image`; `local_worker_cli.py`/`queue_drain_cli.py` los drenan y `import_runner.py` delega en MuScriptor, adquisición YouTube o OMR. Evidencia: `src/drumcoach_app/local_worker_cli.py:14-55`, `queue_drain_cli.py:21-123`, `import_runner.py:82-424`. 4. **[Hecho] Pipeline de material:** los eventos se normalizan y convierten en `PracticeScore` —schema 1 para batería, schema 2 para partes afinadas—; después se publican MusicXML, playback, provenance, diagnósticos y `note-trace`. La ruta de imagen convierte MusicXML OMR en eventos de piano. Evidencia: `src/drumcoach_spike/practice_score.py:99-250`, `src/drumcoach_app/import_runner.py:426-594`, `src/drumcoach_spike/transcription_pipeline.py:133-364`, `src/drumcoach_spike/omr.py:24-191`. 5. **[Hecho] Práctica y assistant:** `PlayerController` resuelve una parte activa mediante `DrumCoachRepository`, `TimelineEngine` y el score; `generated_playback.py` deriva notas, límites de compás y timeline para el viewer. El assistant usa herramientas validadas, análisis determinista del teacher y sesiones JSON locales. Evidencia: `src/drumcoach_app/player.py:202-247,316-564`, `src/drumcoach_app/timeline.py:64-190`, `src/drumcoach_app/generated_playback.py:47-243`, `src/drumcoach_app/assistant/orchestrator.py:218-498`, `src/drumcoach_app/assistant/session.py:14-158`. ## Decisiones observadas - **Fuente de verdad:** `practice-score.json`; MusicXML, MIDI, playback, engraving y diagnósticos son proyecciones o sidecars. `src/drumcoach_app/main.py:1335-1357` vuelve a generar MusicXML desde el score cuando procede. - **Cadena de importación confirmada:** job → runner → score canónico → archivos de artefactos → Song/Instrument Part/Revision en SQLite. Los contratos están cubiertos por `tests/test_import_runner.py:19-148` y `tests/test_instruments_phase_one.py:18-106`. - **Rama separada:** `/midi-import` llama directamente a MuScriptor y persiste `midi_explorations` y `DrumScore`; no pasa por una revisión `PracticeScore`. Evidencia: `src/drumcoach_app/main.py:505-552`, `src/drumcoach_app/repository.py:197-203`; pruebas: `tests/test_app.py:139-213`. - **Estado de práctica:** el score y las revisiones viven en SQLite/artefactos; la sesión de player y assistant se guarda en `.local/assistant/sessions/*.json`. Evidencia: `src/drumcoach_app/assistant/session.py:34-59,127-158`. ## Riesgos - **[Hecho] Dependencia de entorno:** la tanda arquitectónica independiente pasó: `40 passed` en `tests/test_repository.py`, `test_import_runner.py` y `test_generated_playback.py`. La tanda ampliada no llegó a recolectar `test_score_image_import.py` ni `test_instruments_phase_one.py` porque `main.py` importa `muscriptor.soundfonts`, que encadena a `torch`, ausente en ese entorno. Evidencia de importación: `src/drumcoach_app/main.py:44-45`. - **[Inferencia]** Si FastAPI debe arrancar sin MuScriptor/torch, la importación superior de `main.py` es una frontera frágil; la opción segura sería cargar esas dependencias sólo en las rutas que las usan. - **[Incógnita]** No queda demostrado en este entorno que el conjunto completo de endpoints HTTP pueda ejecutarse hasta el worker real; sí están cubiertos los contratos de repository, runners, score, playback y teacher mediante pruebas aisladas. ## Próximos pasos 1. Confirmar si el arranque de FastAPI debe funcionar sin `torch`/MuScriptor. Opción segura: mantener el core HTTP y biblioteca arrancables, y diferir la carga del runtime de transcripción. 2. Ejecutar la suite ampliada con el entorno declarado por el proyecto y verificar `/health`, creación de job, drenaje de un job y lectura de una revisión activa. 3. Mantener separadas en la documentación técnica las dos rutas reales: importación canónica a `PracticeScore` y exploración directa MIDI. ```mermaid flowchart LR Browser["Browser / viewer"] -->|HTTP| API["main.py<br/>FastAPI"] Source["Audio local / raw JSONL / YouTube URL / score image"] --> API API --> Repo["repository.py<br/>DrumCoachRepository"] Repo --> SQLite[("SQLite<br/>songs, parts, revisions, jobs, bundles")] API --> Jobs["Import jobs"] Jobs --> Repo Worker["local_worker_cli.py<br/>queue_drain_cli.py"] --> Jobs Worker --> Runner["import_runner.py"] Runner --> Adapter["transcription_adapter.py<br/>MuScriptor"] Runner --> OMR["omr.py<br/>OMR opcional"] Runner --> Acquisition["source_acquisition.py"] Runner --> Score["practice_score.py<br/>PracticeScore canónico"] Runner --> Artifacts[("artifact_root<br/>JSON, JSONL, MusicXML, diagnósticos")] Runner --> Engraver["musescore_engraver.py<br/>engraving opcional"] Score --> MusicXML["musicxml.py"] Score --> Playback["generated_playback.py"] API --> Player["player.py<br/>PlayerController"] Repo --> Player Player --> Timeline["timeline.py<br/>TimelineEngine"] Player --> Score Player --> Playback Playback --> Browser MusicXML --> Browser API --> Assistant["assistant/orchestrator.py"] Assistant --> Provider["Local LFM provider"] Assistant --> Tools["assistant/tools.py"] Tools --> Teacher["teacher/analyse.py<br/>análisis determinista"] Teacher --> Score Teacher --> Player Assistant --> Sessions[(".local/assistant/sessions/*.json")] Assistant --> Browser API --> MIDI["/midi-import"] MIDI --> Adapter MIDI --> MIDIStore[("midi_explorations<br/>+ DrumScore files")] MIDIStore --> Browser ```
Browser / viewer
Browser
Audio local / raw JSONL /YouTube URL / score image
Source
local_worker_cli.py<br/>queue_drain_cli.py
Worker
main.py<br/>FastAPI
API
import_runner.py
Runner
repository.py<br/>DrumCoachRepository
Repo
Import jobs
Jobs
transcription_adapter.py<br/>MuScriptor
Adapter
omr.py<br/>OMR opcional
OMR
source_acquisition.py
Acquisition
practice_score.py<br/>PracticeScorecanónico
Score
("artifact_root<br/>JSON,JSONL, MusicXML,diagnósticos")
Artifacts
musescore_engraver.py<br/>engravingopcional
Engraver
assistant/orchestrator.py
Assistant
/midi-import
MIDI
("SQLite<br/>songs,parts, revisions, jobs,bundles")
SQLite
musicxml.py
MusicXML
generated_playback.py
Playback
player.py<br/>PlayerController
Player
Local LFM provider
Provider
assistant/tools.py
Tools
(".local/assistant/sessions/*.json")
Sessions
("midi_explorations<br/>+DrumScore files")
MIDIStore
timeline.py<br/>TimelineEngine
Timeline
teacher/analyse.py<br/>análisisdeterminista
Teacher
Mapa de relaciones · generado por OMP con evidencia del proyecto
