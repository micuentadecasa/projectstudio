✦
OMP
## Resumen de hallazgos 1. **Propósito y frontera — Hecho:** DrumCoach es una herramienta personal, local-first, que convierte material musical permitido en `Practice Score`, notación legible y práctica sincronizada. No es catálogo público, SaaS ni servicio alojado. Evidencia: `docs/product/architecture.md:5-9,34-40`; `README.md:1-3,43-49`. 2. **Actores y casos de uso — Hecho:** actores principales: aprendiz, operador local, MuScriptor y runtime OMR opcional. Casos: importar fuente, ejecutar worker local, explorar biblioteca, abrir/practicar una revisión y pedir guía contextual. El código confirma las rutas `/imports`, `/songs`, `/instrument-parts/...` y `/assistant/turn` en `src/drumcoach_app/main.py:626-718,970-1010,1231-1469`. 3. **Bounded contexts — Hecho:** `Instrument-Specific Ingestion`, `Practice Material`, `Interactive Notation Player` y `Contextual Practice Coaching`. Evidencia: `docs/product/model/domain/bounded-contexts/bc-*.md`; entidades persistidas `Song`, `InstrumentPart`, `PracticeScoreRevision`, `ImportBundle` e `ImportJob` en `src/drumcoach_app/repository.py:11-87,188-255`. 4. **Reglas estructurales — Hecho:** `Practice Score JSON` es la fuente canónica; MusicXML, MIDI, playback, diagnósticos y engraving son derivados. Los imports se restringen por instrumento y los bundles crean jobs hijos independientes. El coaching usa análisis determinista, rephrasing acotado y confirmación explícita antes de reproducir. Evidencia: `docs/product/model/business-rules/br-*.md`; `src/drumcoach_spike/practice_score.py:99-115`; `src/drumcoach_app/assistant/tools.py:1423-1508`. 5. **Restricciones e incógnitas — Hecho:** ejecución local sobre macOS, SQLite y archivos; OMR acepta PNG/JPEG/WebP y falla de forma durable si falta; el worker es secuencial y recupera jobs interrumpidos. **Inferencia:** importación, biblioteca y reproductor forman el núcleo; coaching, voz, OMR y engraving son capacidades opcionales o experimentales. **Incógnita:** el repositorio aún no fija si esas capacidades deben considerarse compromiso de producto. Evidencia: `docs/product/architecture.md:44-67,101-108`; `src/drumcoach_app/local_worker_cli.py:14-55`; `src/drumcoach_spike/omr.py:51-138`. ## Decisiones - **Vista de producto confirmada:** los nodos siguientes sólo corresponden a componentes, actores y límites evidenciados en `docs/product` y el código. ```mermaid flowchart LR L["Aprendiz"] O["Operador local"] S["Fuente: audio, raw events, URL o imagen"] M["MIDI: exploración directa"] X["Exploración MIDI no canónica"] A["Aplicación local FastAPI"] J["Import Job / Import Bundle"] W["Worker local secuencial"] T["Transcription Adapter / MuScriptor"] OMR["OMR opcional"] P["Pipeline de Practice Score"] C["Practice Score JSON canónico"] D["Artefactos derivados y provenance"] DB["SQLite: Song, Parts, Revisions y Jobs"] LIB["Biblioteca local"] PLAYER["Interactive Notation Player"] COACH["Análisis determinista / Practice Teacher"] GUIDE["Guía y acción pendiente"] O -->|configura y lanza| A L -->|aporta o selecciona| S S --> A L -->|explora| M M --> X A -->|valida y encola| J W -->|drena| J J -->|audio o URL| T J -->|raw events| P J -->|imagen PNG/JPEG/WebP| OMR T --> P OMR --> P P --> C P --> D J --> DB C --> DB DB --> LIB D --> LIB LIB --> PLAYER C --> COACH COACH --> GUIDE GUIDE -->|acción pendiente| L L -->|confirma| PLAYER ``` - El camino canónico confirmado es: **fuente → job local → score canónico → revisión persistida → biblioteca → reproductor**. - MIDI queda separado como exploración no canónica; el endpoint correspondiente está documentado como independiente en `src/drumcoach_app/main.py:505-570` y `docs/product/model/business-rules/br-instrument-specific-jobs.md:14-24`. - La evidencia ejecutada cubre los contratos principales: **62 pruebas pasaron** en imports, OMR, bundles, player y teacher; quedó una advertencia deprecada de `httpx` en `TestClient`. ## Riesgos - **Deriva de alcance:** `docs/product/recovery-brief.yaml:79-87` reconoce contradicciones entre el núcleo local-first y capacidades nuevas. Presentar coaching, voz o multiinstrumento como núcleo sin decisión explícita puede inflar compromiso y presupuesto. - **Dependencias locales:** MuScriptor y OMR pueden faltar, tardar o producir resultados de baja calidad; el diseño conserva fallos visibles, pero la operación, modelos, permisos y archivos siguen bajo responsabilidad local. - **Confusión de fuentes de verdad:** tratar MusicXML, MIDI o engraving como canónicos rompería la regenerabilidad definida en `br-score-json-canonical.md` y `br-derived-artifacts.md`. - **Validación ProductShape pendiente:** `prodshape validate` no pudo ejecutarse porque el comando no está disponible en el entorno (`command not found`). ## Próximos pasos 1. Resolver una única decisión de alcance: **¿coaching, voz, OMR y engraving son producto comprometido o capacidades experimentales?** Opción segura: mantener como núcleo importación, score canónico, biblioteca y reproducción; etiquetar el resto como opcional. 2. Instalar o invocar la CLI de ProductShape y ejecutar `prodshape validate`. 3. Convertir la decisión de alcance en una actualización revisada de `docs/product/model/` mediante el flujo de cambios existente; no modificar el código hasta cerrar esa decisión.
Aprendiz
L
Operador local
O
Worker local secuencial
W
Fuente: audio, rawevents, URL o imagen
S
MIDI: exploración directa
M
Exploración MIDI nocanónica
X
Aplicación local FastAPI
A
Import Job / ImportBundle
J
Transcription Adapter /MuScriptor
T
OMR opcional
OMR
Pipeline de PracticeScore
P
Practice Score JSONcanónico
C
Artefactos derivados yprovenance
D
SQLite: Song, Parts,Revisions y Jobs
DB
Biblioteca local
LIB
Interactive NotationPlayer
PLAYER
Análisis determinista /Practice Teacher
COACH
Guía y acción pendiente
GUIDE
Mapa de relaciones · generado por OMP con evidencia del proyecto
