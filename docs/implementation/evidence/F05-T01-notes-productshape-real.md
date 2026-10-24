✦
OMP
# Hallazgos 1. **Propósito y límite del producto.** Notes/DrumCoach es una herramienta personal, local-first: el aprendiz aporta audio, vídeo/MIDI o una imagen de partitura; el sistema genera material instrumental de práctica y permite leerlo y practicarlo con playback sincronizado. No hay catálogo hospedado, cuentas, autenticación, API pública de transcripción ni cola distribuida. **Actores:** aprendiz y operador local. **Casos de uso:** importar fuente, explorar biblioteca, practicar score y ejecutar worker local. **Bounded contexts implicados:** `BC-TRANSCRIPTION`, `BC-PRACTICE-MATERIAL`, `BC-PRACTICE-PLAYBACK`. **Evidencia:** `docs/product/architecture.md:5-9,34-40,101-108`; `docs/product/model/actors/act-learner.md:13-23`; `docs/product/model/actors/act-local-operator.md:13-23`; `src/drumcoach_app/main.py:64-75`. 2. **La ingestión es instrumental, persistida y observable.** `BC-TRANSCRIPTION` acepta `raw_events`, audio local, URL de YouTube y `score_image`. Un job apunta a un instrumento; un bundle puede crear jobs hijos para batería, teclado y guitarra bajo una misma canción. El sistema valida la entrada, encola el job y expone estados `queued`, `running`, `succeeded`, `failed` o equivalentes del bundle. **Actores:** aprendiz, operador local, MuScriptor y runtime OMR opcional. **Reglas:** la transcripción se restringe al instrumento solicitado; la exploración MIDI directa es una excepción no canónica. **Evidencia:** `docs/product/model/domain/bounded-contexts/bc-transcription.md:12-22`; `docs/product/model/business-rules/br-instrument-specific-jobs.md:14-24`; `src/drumcoach_app/main.py:970-1010,1053-1071,1174-1183`; `src/drumcoach_app/repository.py:380-426,801-855`; `src/drumcoach_app/import_runner.py:192-243,245-284`. 3. **Practice Material tiene una única fuente de verdad.** El agregado funcional es `Song → InstrumentPart → PracticeScoreRevision`. `Practice Score JSON` es el artefacto canónico; MusicXML, MIDI, diagnósticos, playback generado y engraving son derivados. Se conserva provenance y material bruto para inspección y regeneración. **Reglas:** los artefactos derivados no pueden convertirse silenciosamente en otro modelo canónico; los eventos de otras familias no se mezclan en el score seleccionado. **Evidencia:** `docs/product/model/domain/bounded-contexts/bc-practice-material.md:12-22`; `docs/product/model/business-rules/br-score-json-canonical.md:14-24`; `docs/product/model/business-rules/br-derived-artifacts.md:14-24`; `src/drumcoach_app/repository.py:593-675`; `src/drumcoach_app/import_runner.py:442-529,580-594`; `src/drumcoach_spike/practice_score.py:99-115,238-250`. 4. **La práctica se organiza alrededor del score activo y un transporte compartido.** `BC-PRACTICE-PLAYBACK` carga la revisión activa, la notación y el payload de playback desde el mismo material. El aprendiz puede seleccionar compases, reproducir, pausar, detener, cambiar tempo, activar loop, metrónomo, count-in y elegir score/audio original/mix cuando exista. El player no modifica el score canónico. **Caso de uso:** abrir una revisión guardada y practicar una sección. **Evidencia:** `docs/product/model/domain/bounded-contexts/bc-practice-playback.md:12-22`; `docs/product/model/use-cases/uc-practise-score.md:16-35`; `src/drumcoach_app/player.py:355-386,412-475,477-564`. 5. **El coaching contextual es una capacidad acotada, no una autoridad musical.** `BC-PRACTICE-COACHING` analiza determinísticamente el fragmento seleccionado, construye un plan pedagógico y permite reexpresarlo mediante el asistente. El modelo de lenguaje no calcula ticks ni hechos musicales. Toda acción de playback queda pendiente hasta confirmación explícita del aprendiz; voz es sólo una capa local opcional alrededor del turno del asistente. **Caso de uso:** pedir guía sobre ritmo, armonía, manos de piano, guitarra, vocalización o salud del score. **Evidencia:** `docs/product/model/domain/bounded-contexts/bc-practice-coaching.md:12-22`; `docs/product/model/business-rules/br-human-review-teacher.md:14-24`; `docs/product/model/requirements/functional/fr-coach-practice.md:17-21`; `src/drumcoach_app/assistant/tools.py:1034-1057,1469-1502`; `docs/product/model/requirements/constraints/con-optional-voice.md:13-20`. 6. **Las restricciones operativas forman parte del producto.** El baseline soportado es macOS local con Python/uv, FFmpeg, SQLite y archivos bajo raíces configurables. OMR y voz son opcionales y deben fallar de forma visible y durable sin impedir el arranque principal. Las imágenes aceptadas son PNG, JPEG y WebP; PDF está excluido. El producto no promete despliegue multiusuario, scheduler de producción ni edición general de notación. **Evidencia:** `docs/product/model/requirements/constraints/con-macos-local-runtime.md:13-20`; `docs/product/model/requirements/constraints/con-local-sqlite.md:13-20`; `docs/product/model/requirements/constraints/con-optional-omr.md:13-20`; `docs/product/model/requirements/quality/qr-local-availability.md:18-22`; `src/drumcoach_app/main.py:920-968`. ## DIAGRAMA ```mermaid flowchart LR L["ACT-LEARNER<br/>Aprendiz"] O["ACT-LOCAL-OPERATOR<br/>Operador local"] M["ACT-MUSCRIPTOR<br/>MuScriptor"] R["ACT-OMR-RUNTIME<br/>OMR opcional"] C1["Importar fuente"] C2["Ejecutar jobs locales"] C3["Persistir y explorar material"] C4["Practicar score activo"] C5["Pedir guía contextual"] T["BC-TRANSCRIPTION<br/>Instrument-Specific Ingestion"] PM["BC-PRACTICE-MATERIAL<br/>Practice Material"] PP["BC-PRACTICE-PLAYBACK<br/>Interactive Notation Player"] PC["BC-PRACTICE-COACHING<br/>Contextual Practice Coaching"] L --> C1 O --> C2 L --> C3 L --> C4 L --> C5 C1 --> T C2 --> T M --> T R --> T T --> PM C3 --> PM PM --> C4 C4 --> PP PM --> C5 C5 --> PC PC --> PP ```
"ACT-LEARNER<br/>Aprendiz"
L
→
"ACT-LOCAL-OPERATOR<br/>Operador local"
O
→
"ACT-MUSCRIPTOR<br/>MuScriptor"
M
→
"ACT-OMR-RUNTIME<br/>OMR opcional"
R
→
"Importar fuente"
C1
→
"Ejecutar jobs locales"
C2
→
"Persistir y explorar material"
C3
→
"Practicar score activo"
C4
→
"Pedir guía contextual"
C5
→
"BC-TRANSCRIPTION<br/>Instrument-Specific Ingestion"
T
→
"BC-PRACTICE-MATERIAL<br/>Practice Material"
PM
→
"BC-PRACTICE-PLAYBACK<br/>Interactive Notation Player"
PP
→
"BC-PRACTICE-COACHING<br/>Contextual Practice Coaching"
PC
Generado por OMP · basado en el bloque Mermaid recibido
