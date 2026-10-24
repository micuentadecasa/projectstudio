# Notes / DrumCoach — revisión brownfield

## Proyecto activo

- Ruta local: `/Users/luis/projects/notes`
- Integración: `PROJECTSTUDIO_PROJECT_ROOT=/Users/luis/projects/notes`
- OMP: proceso real `omp --mode rpc`, autenticación y modelo del usuario.
- ProjectStudio no modifica el repositorio Notes.

## Estado observado antes de la revisión

- Rama: `main`
- Estado: contiene cambios locales del proyecto Notes; no se descartan ni se escriben desde ProjectStudio.
- `pyproject.toml`: paquete `drumcoach`, versión `0.1.0`, Python `>=3.11`.
- Dependencias declaradas: FastAPI, certifi, jsonschema, muscriptor y uvicorn.
- Entradas CLI declaradas: `drumcoach-spike`, conversión audio-score, imports raw/local-audio/YouTube/score-image, worker local y utilidades de MusicXML/Practice Score.

## Fuentes para ProductShape

La revisión ProductShape debe usar como fuente primaria:

- `docs/product/model/use-cases/`
- `docs/product/model/requirements/`
- `docs/product/model/constraints/`
- `docs/product/model/journeys/`
- `docs/product/model/domain/`
- `docs/product/model/business-rules/`
- `docs/product/model/behaviours/`
- `docs/product/model/actors/`

El modelo de producto está organizado explícitamente por casos de uso, requisitos, restricciones, journeys, términos de dominio, bounded contexts, reglas de negocio, comportamientos y actores.

## Fuentes para arquitectura

- `src/drumcoach_app/main.py`: FastAPI, rutas/servicios de aplicación, SQLite y raíces de artefactos/viewers.
- `src/drumcoach_app/import_runner.py`: ejecución de jobs de importación y publicación de artefactos.
- `src/drumcoach_spike/transcription_pipeline.py`: pipeline local de audio a Practice Score y sidecars.
- `src/drumcoach_spike/musicxml.py`: proyección MusicXML.
- `tests/`: contratos de pipeline, importación, engraving y ciclo de eventos pitched.

## Grafo existente

`graphify-out/GRAPH_REPORT.md` informa 599 archivos, 6.611 nodos y 14.532 aristas. El informe fue construido sobre el commit corto `e7a7fe89`; el HEAD observado actualmente es `a5cb123b`, por lo que el grafo se considera histórico/no fresco hasta ejecutar `graphify update .` dentro de Notes.

## Evidencia de OMP

- ProductShape real: `docs/implementation/evidence/F05-T01-notes-productshape-real.png`
- Arquitectura real: `docs/implementation/evidence/F05-T02-notes-architecture-real.png`
- Comando reproducible: `pnpm test:e2e:notes`

## Hallazgos reales de ProductShape

OMP leyó primero `docs/product/` y corroboró con el código:

1. DrumCoach es una herramienta local-first para convertir material musical propio en práctica con partes instrumentales, notación y reproducción sincronizadas. Actores principales: `learner` y `local operator`. Evidencia: `docs/product/architecture.md`, `docs/product/model/actors/act-learner.md`, `docs/product/model/actors/act-local-operator.md`.
2. La ingestión es específica por instrumento y persiste jobs locales para `raw_events`, audio local, YouTube e imagen de partitura. Evidencia: `bc-transcription.md`, `uc-import-source.md`, `uc-run-local-worker.md`, `repository.py`, `local_worker_cli.py`.
3. `Practice Score JSON` es la fuente canónica; MusicXML, MIDI, diagnósticos, engraving y sidecars son derivados regenerables. La provenance y los eventos raw/normalizados se conservan.
4. La reproducción abre una revisión activa sin modificarla; el payload se genera desde el score canónico.
5. El coaching contextual es separado y opt-in: el análisis musical es determinista, el LLM sólo puede reformular y las acciones requieren confirmación.
6. El runtime es local sobre macOS/Python/SQLite; OMR y voz son opcionales y los fallos de jobs quedan persistidos.

## Hallazgos reales de arquitectura

1. `src/drumcoach_app/main.py` es la frontera FastAPI y ensamblador: requests, SQLite, repositorio, rutas de imports/scores/artifacts/player/assistant y archivos estáticos.
2. `local_worker_cli.py` y `queue_drain_cli.py` drenan jobs; `import_runner.py` orquesta audio, raw events, YouTube e imagen.
3. `transcription_adapter.py` conecta MuScriptor; `omr.py` mantiene el límite opcional de score-image.
4. `practice_score.py` construye el modelo canónico; `musicxml.py`, `musescore_engraver.py` y los sidecars publican derivados.
5. `generated_playback.py` y `player.py` proyectan reproducción; `teacher/*` y `assistant/*` quedan detrás de la capa de coaching/assistant.

## Diagrama generado por OMP

El diagrama ProductShape confirmó la cadena `Learner/Local operator → ingestión → Practice Material → Playback → Coaching`, con MuScriptor y OMR como actores/adaptadores.

El diagrama de arquitectura confirmó la cadena `FastAPI → local worker/queue → repository SQLite → import runners → adapters → Practice Score → MusicXML/artifacts → player/teacher/assistant`.

Las respuestas completas del proceso real y las capturas son:

- `docs/implementation/evidence/F05-T01-notes-productshape-real.md`
- `docs/implementation/evidence/F05-T01-notes-productshape-real.png`
- `docs/implementation/evidence/F05-T01-notes-productshape-real.mermaid`: Mermaid original guardado desde la respuesta real de OMP para probar el renderer sin otra llamada.
- `docs/implementation/evidence/F05-T02-notes-architecture-real.md`
- `docs/implementation/evidence/F05-T02-notes-architecture-real.png`
