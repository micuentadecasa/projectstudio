✦
OMP
PRODUCTSHAPE — draft

Objetivo actual: reconstruir la forma observable del producto a partir de documentación y código, sin inventar componentes.

Estado: `draft`, confianza global `medium`. No existe `docs/product/`; la intención de producto está distribuida entre `README.md`, ADRs, `docs/` y el código. El mapa del grafo confirma como núcleos `main.py`, `repository.py`, `import_runner.py`, `player.py` y los módulos de transcripción, pero no sustituye una definición de producto.

Hallazgos verificables

Propósito

DrumCoach es una aplicación local para convertir audio o MIDI en material de práctica con partitura legible. Su promesa principal es mostrar una transcripción fiel, no simplificarla automáticamente.
• Propósito declarado: `README.md:1-3`.
• Entradas y resultados: `README.md:43-49`.
• Prioridad por transcripción fiel: `docs/adr/0003-faithful-transcription-over-practice-simplification.md:1`.
• Referencia de experiencia: reproducción sincronizada, navegación por partitura, tempo y bucles: `docs/adr/0016-soundslice-as-ui-reference.md:1`.

Actores

1. Practicante local
   Persona que aporta una grabación o fuente musical, consulta su biblioteca y practica una parte instrumental. El producto es personal, local y sin postura de servicio hospedado: `README.md:1-3`, `docs/adr/0001-local-first-v1.md:1`.

2. Navegador local
   Superficie para biblioteca, importación, partitura, reproducción, asistente y voz: `docs/voice.md:3-13`, `src/drumcoach_app/main.py:571-588`, `src/drumcoach_app/main.py:841-866`.

3. MuScriptor 0.3.0
   Motor externo de transcripción. El adaptador limita la inferencia por familia instrumental: `docs/audio-transcription-api.md:60-72`, `src/drumcoach_spike/transcription_adapter.py:18-40`.

4. Runtime OMR
   Dependencia opcional para convertir imágenes de partituras de piano; puede ser HOMR o un comando externo: `README.md:59`, `docs/score-image-import.md` — el flujo se registra en `src/drumcoach_app/main.py:920-968`.

5. MuseScore 4
   Motor externo opcional de grabado/engraving para importaciones instrumentales independientes: `docs/per-instrument-scores.md:61-103`.

6. Fuente NAS/YouTube mediante `yt-dlp`
   Fuente externa para búsqueda, título, miniatura y audio: `src/drumcoach_spike/source_acquisition.py:38-170`, `src/drumcoach_app/main.py:1123-1141`.

7. Servicios locales de voz y asistente
   Whisper procesa entrada de voz; el asistente usa un LFM local; AVSpeechSynthesizer lee respuestas: `docs/voice.md:1-13`, `docs/voice.md:67-88`, `src/drumcoach_app/main.py:626-667`.

Casos de uso observados
• Importar una grabación local como paquete de batería, teclado y guitarra: `src/drumcoach_app/main.py:879-918`, `docs/adr/0010-instrument-specific-ingestion.md:1`.
• Importar una partitura de un único instrumento: `src/drumcoach_app/main.py:1013-1121`, `docs/per-instrument-scores.md:35-44`.
• Importar una imagen de partitura de piano: `src/drumcoach_app/main.py:920-968`.
• Crear importaciones desde una URI o eventos JSONL: `src/drumcoach_app/main.py:970-1011`.
• Buscar una fuente de biblioteca/NAS: `src/drumcoach_app/main.py:1123-1141`.
• Consultar estado, reintentar o cancelar importaciones: `src/drumcoach_app/main.py:870-878`, `src/drumcoach_app/main.py:1143-1183`.
• Explorar transcripción MIDI directamente sin convertirla en la ruta canónica de Practice Score: `src/drumcoach_app/main.py:505-569`.
• Navegar por canciones, partes instrumentales y revisiones: `src/drumcoach_app/main.py:1231-1306`.
• Abrir una parte y practicar con partitura sincronizada: `docs/generic-practice-player.md:1-31`, `src/drumcoach_app/main.py:669-779`.
• Practicar por rango de compases, tempo, loop, metrónomo, entrada y fuente de reproducción: `src/drumcoach_app/player.py:412-564`.
• Escuchar sólo voces seleccionadas de batería: `src/drumcoach_app/main.py:1450-1469`, `docs/music-practice-teacher.md:117-125`.
• Preguntar al asistente por ritmo, armonía, manos de piano o guitarra: `docs/music-practice-teacher.md:1-23`, `docs/music-practice-teacher.md:93-124`.
• Usar voz como entrada/salida del mismo asistente: `docs/voice.md:1-13`, `src/drumcoach_app/main.py:370-423`.

Términos de dominio
• Song: unidad de biblioteca asociada a una fuente: `src/drumcoach_app/repository.py:11-19`.
• InstrumentPart: parte de batería, teclado o guitarra dentro de una canción: `src/drumcoach_app/repository.py:30-37`.
• PracticeScoreRevision: revisión versionada con BPM, desfase y rutas de artefactos: `src/drumcoach_app/repository.py:39-50`.
• ImportBundle: conjunto de trabajos derivados de una misma fuente: `src/drumcoach_app/repository.py:52-63`.
• ImportJob: trabajo persistido con fuente, instrumento, estado y revisión resultante: `src/drumcoach_app/repository.py:65-88`.
• Practice Score: modelo canónico de notación y práctica: `docs/audio-transcription-api.md:23-49`, `docs/adr/0040-json-practice-score-storage.md:1`.
• Raw events / normalized events: evidencia de transcripción preservada antes de proyectar la partitura: `src/drumcoach_spike/transcription_pipeline.py:87-105`, `src/drumcoach_spike/transcription_pipeline.py:290-327`.
• Active revision: revisión seleccionada para servir partitura, materiales y reproducción: `src/drumcoach_app/repository.py:205-223`, `src/drumcoach_app/main.py:1291-1362`.
• PlayerSession: estado de una sesión de reproducción y práctica: `src/drumcoach_app/player.py:131-178`, `src/drumcoach_app/player.py:316-386`.
• PracticeRange: selección de compases con identidad propia en la sesión: `docs/generic-practice-player.md:51-59`, `src/drumcoach_app/player.py:412-427`.
• MidiExploration: exploración separada de salida MIDI: `src/drumcoach_app/repository.py:21-28`, `src/drumcoach_app/main.py:505-569`.

Bounded contexts

No están nombrados explícitamente como bounded contexts. La siguiente partición es una inferencia arquitectónica, respaldada por límites de persistencia, rutas y documentación:

1. Ingestión y transcripción — fuentes, búsqueda, paquetes, trabajos, worker, MuScriptor y OMR.
   Evidencia: `src/drumcoach_app/main.py:184-287`, `src/drumcoach_app/import_runner.py:82-401`, `src/drumcoach_app/repository.py:225-256`.

2. Modelo de partitura y artefactos — Practice Score canónico, eventos, provenance, MusicXML, MIDI de reproducción, diagnósticos y engraving.
   Evidencia: `src/drumcoach_spike/transcription_pipeline.py:87-105`, `src/drumcoach_spike/transcription_pipeline.py:290-364`, `src/drumcoach_app/main.py:1308-1469`.

3. Biblioteca y revisiones — canciones, partes, revisiones activas, eliminación y exportación.
   Evidencia: `src/drumcoach_app/repository.py:11-50`, `src/drumcoach_app/main.py:1231-1306`, `src/drumcoach_app/main.py:1501-1519`.

4. Práctica y reproducción — sesión, rango, transporte, tempo, loop, mezcla, metrónomo y audio original.
   Evidencia: `docs/generic-practice-player.md:1-31`, `src/drumcoach_app/player.py:316-564`.

5. Asistente y profesor contextual — análisis simbólico determinista, plan pedagógico, reexpresión por LFM y acciones confirmadas.
   Evidencia: `docs/music-practice-teacher.md:11-23`, `docs/music-practice-teacher.md:93-124`, `src/drumcoach_app/main.py:626-779`.

6. Exploración MIDI y diagnóstico — salida directa para inspección, separada del flujo canónico de importación.
   Evidencia: `src/drumcoach_app/main.py:505-569`, `docs/adr/0036-event-stream-first-transcription.md:1`.

Reglas de negocio y restricciones
• Practice Score JSON es canónico; MusicXML, MIDI, diagnósticos y páginas de inspección son derivados: `README.md:43-49`, `README.md:89`, `docs/adr/0036-event-stream-first-transcription.md:1`.
• La transcripción conserva eventos sin añadir golpes o articulaciones no detectados: `docs/audio-transcription-api.md:46-49`.
• Una fuente puede producir partes independientes de batería, teclado y guitarra; los trabajos hijos pueden reintentarse separadamente: `docs/adr/0010-instrument-specific-ingestion.md:1`.
• El teclado usa `acoustic_piano` por defecto; `electric_piano` requiere elección explícita: `docs/per-instrument-scores.md:48-59`, `src/drumcoach_app/main.py:99-109`.
• El worker local procesa un trabajo cada vez; no hay Redis, Celery ni workers distribuidos: `docs/adr/0034-single-local-ingestion-worker.md:1`, `src/drumcoach_app/main.py:205-287`.
• Un trabajo en estado `running` queda fallido tras reiniciar la aplicación: `src/drumcoach_app/main.py:185-202`.
• Las grabaciones de transcripción están limitadas a diez minutos: `src/drumcoach_spike/audio_duration.py:10-16`, `src/drumcoach_app/main.py:1730-1733`.
• Las cargas de audio HTTP tienen límite de 100 MB: `src/drumcoach_app/main.py:889-895`.
• Las imágenes admitidas son PNG, JPEG y WebP; PDF no está soportado; el límite es 25 MB: `src/drumcoach_app/main.py:920-945`.
• La selección de compases y tempo se valida contra la partitura activa; el tempo permitido está entre 25 % y 150 %: `src/drumcoach_app/player.py:350-377`, `src/drumcoach_app/player.py:477-488`.
• El reproductor no inicia sonido automáticamente al entrar: `docs/generic-practice-player.md:70-79`.
• El profesor no puede inventar ticks, compases o hechos musicales; las explicaciones deben partir de análisis verificable: `docs/music-practice-teacher.md:11-23`.
• La reproducción propuesta por el profesor requiere confirmación y revalidación: `docs/music-practice-teacher.md:110-116`.
• El audio de voz no se persiste; el audio original de las canciones puede retenerse opcionalmente: `docs/voice.md:82-88`, `docs/adr/0019-source-audio-retention-is-optional.md:1`.
• El producto está limitado a uso local, personal y no comercial; no es un servicio hospedado: `README.md:13-22`, `LICENSE:5-11`.
• El baseline técnico es macOS Apple Silicon con MuScriptor medium como modelo por defecto: `docs/adr/0038-apple-silicon-v1-baseline.md:1`.

Observaciones críticas

1. La documentación de producto está ausente. `docs/product/` no existe; propósito, actores y límites deben reconstruirse desde documentos técnicos y ADRs.

2. La corrección tiene una frontera ambigua. El ADR declara un editor mínimo en v1, pero `README.md:78` excluye un editor completo y el código observado expone correcciones en la CLI (`src/drumcoach_spike/cli.py:39-103`, `src/drumcoach_spike/corrections.py:8-42`), no como flujo HTTP visible. La vista actual debe tratarlo como capacidad de spike/CLI, no como caso de uso de la aplicación web confirmado.

3. La ruta MIDI tiene dos verdades según el nivel. La exploración directa persiste un `DrumScore` como fuente de esa exploración y una proyección compatible para APIs existentes, mientras que la ingestión normal parte del event stream y genera una Practice Score. Esto está documentado como una ruta no canónica: `src/drumcoach_app/main.py:505-569`, `docs/adr/0036-event-stream-first-transcription.md:1`.

Diagrama confirmado

PDAC respaldado

```json
{
  "pdac": [
    {
      "type": "actor",
      "title": "Practicante local",
      "detail": "Persona que importa material musical, consulta la biblioteca y practica partes instrumentales en una máquina local.",
      "evidence": "README.md:1-3; docs/adr/0001-local-first-v1.md:1",
      "confidence": "high"
    },
    {
      "type": "actor",
      "title": "Navegador local",
      "detail": "Interfaz para biblioteca, importación, reproducción, asistente y voz.",
      "evidence": "docs/voice.md:1-13; src/drumcoach_app/main.py:571-588",
      "confidence": "high"
    },
    {
      "type": "actor",
      "title": "MuScriptor 0.3.0",
      "detail": "Motor externo que genera eventos de transcripción con máscaras por familia instrumental.",
      "evidence": "docs/audio-transcription-api.md:60-72; src/drumcoach_spike/transcription_adapter.py:18-40",
      "confidence": "high"
    },
    {
      "type": "actor",
      "title": "Runtime OMR",
      "detail": "Dependencia opcional para reconocer imágenes de partituras de piano.",
      "evidence": "README.md:59; src/drumcoach_app/main.py:920-968",
      "confidence": "high"
    },
    {
      "type": "actor",
      "title": "MuseScore 4",
      "detail": "Motor externo opcional de engraving para importaciones instrumentales independientes.",
      "evidence": "docs/per-instrument-scores.md:61-103",
      "confidence": "high"
    },
    {
      "type": "actor",
      "title": "NAS/YouTube mediante yt-dlp",
      "detail": "Fuente externa para buscar, resolver y descargar material musical.",
      "evidence": "src/drumcoach_spike/source_acquisition.py:38-170; src/drumcoach_app/main.py:1123-1141",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Importar audio local como paquete instrumental",
      "detail": "Retiene una grabación y crea trabajos para batería, teclado y guitarra.",
      "evidence": "src/drumcoach_app/main.py:879-918; docs/adr/0010-instrument-specific-ingestion.md:1",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Importar una parte instrumental independiente",
      "detail": "Crea un trabajo independiente para una familia instrumental solicitada.",
      "evidence": "src/drumcoach_app/main.py:1013-1121; docs/per-instrument-scores.md:35-44",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Importar imagen de partitura de piano",
      "detail": "Acepta una imagen válida, la retiene y encola una importación de teclado.",
      "evidence": "src/drumcoach_app/main.py:920-968",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Buscar e importar una fuente externa",
      "detail": "Busca canciones y puede usar una URI de biblioteca/NAS como fuente de importación.",
      "evidence": "src/drumcoach_app/main.py:1123-1141; src/drumcoach_app/main.py:970-1011",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Gestionar trabajos de importación",
      "detail": "Consulta estado, reintenta y cancela trabajos persistidos.",
      "evidence": "src/drumcoach_app/main.py:870-878; src/drumcoach_app/main.py:1143-1183",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Explorar una transcripción MIDI directamente",
      "detail": "Genera MIDI y artefactos de exploración sin usar el flujo normal de revisiones canónicas.",
      "evidence": "src/drumcoach_app/main.py:505-569; docs/adr/0036-event-stream-first-transcription.md:1",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Practicar con notación sincronizada",
      "detail": "Abre una parte activa y controla transporte, rango, tempo, loop, metrónomo y fuente de audio.",
      "evidence": "docs/generic-practice-player.md:1-31; src/drumcoach_app/player.py:412-564",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Pedir explicación contextual",
      "detail": "Solicita análisis de ritmo, armonía, manos, guitarra o pedagogía sobre una selección.",
      "evidence": "docs/music-practice-teacher.md:1-23; docs/music-practice-teacher.md:93-124",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Usar voz con el asistente",
      "detail": "Captura voz localmente, la convierte a texto y la envía al mismo flujo del asistente.",
      "evidence": "docs/voice.md:1-13; src/drumcoach_app/main.py:370-423",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Practice Score",
      "detail": "Modelo canónico de partitura de práctica del que se derivan MusicXML, MIDI y diagnósticos.",
      "evidence": "docs/audio-transcription-api.md:23-49; docs/adr/0040-json-practice-score-storage.md:1",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Song",
      "detail": "Unidad de biblioteca asociada a una fuente musical.",
      "evidence": "src/drumcoach_app/repository.py:11-19",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "InstrumentPart",
      "detail": "Parte instrumental de una canción, actualmente batería, teclado o guitarra.",
      "evidence": "src/drumcoach_app/repository.py:30-37; src/drumcoach_app/main.py:99-109",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "PracticeScoreRevision",
      "detail": "Revisión versionada de una parte con BPM, desfase y rutas de artefactos.",
      "evidence": "src/drumcoach_app/repository.py:39-50",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "ImportJob e ImportBundle",
      "detail": "Entidades persistidas para representar trabajos individuales y paquetes de importación.",
      "evidence": "src/drumcoach_app/repository.py:52-88; src/drumcoach_app/repository.py:225-256",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "PlayerSession",
      "detail": "Estado compartido de una sesión de práctica usada por UI y asistente.",
      "evidence": "docs/generic-practice-player.md:1-9; src/drumcoach_app/player.py:131-178",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "PracticeRange",
      "detail": "Selección de compases que se conserva o invalida al cambiar de proyección instrumental.",
      "evidence": "docs/generic-practice-player.md:51-59; src/drumcoach_app/player.py:396-427",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "MidiExploration",
      "detail": "Registro de exploración MIDI separado de la ruta canónica de ingestión.",
      "evidence": "src/drumcoach_app/repository.py:21-28; src/drumcoach_app/main.py:505-569",
      "confidence": "high"
    },
    {
      "type": "journey",
      "title": "De fuente musical a práctica",
      "detail": "El usuario aporta una fuente, se crea un trabajo, el worker transcribe, se publica una Practice Score, se crea una revisión activa y el usuario la abre en el reproductor.",
      "evidence": "src/drumcoach_app/main.py:879-918; src/drumcoach_app/main.py:184-287; src/drumcoach_app/main.py:1291-1469",
      "confidence": "high"
    },
    {
      "type": "journey",
      "title": "De selección a explicación guiada",
      "detail": "El usuario abre una parte, selecciona compases, solicita análisis, recibe una explicación basada en hechos y confirma acciones de reproducción.",
      "evidence": "docs/music-practice-teacher.md:11-23; docs/music-practice-teacher.md:108-124",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "Practice Score como fuente canónica",
      "detail": "MusicXML, MIDI de reproducción, diagnósticos y vistas son proyecciones derivadas.",
      "evidence": "README.md:43-49; docs/adr/0036-event-stream-first-transcription.md:1",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "Separación por instrumento",
      "detail": "Una fuente puede producir partes independientes y cada trabajo se restringe a su familia instrumental.",
      "evidence": "docs/adr/0010-instrument-specific-ingestion.md:1; docs/per-instrument-scores.md:28-40",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "Teclado acústico por defecto",
      "detail": "La importación de teclado no mezcla piano eléctrico salvo petición explícita.",
      "evidence": "docs/per-instrument-scores.md:48-59; src/drumcoach_app/main.py:99-109",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "Análisis musical determinista",
      "detail": "El LFM sólo reexpresa hechos producidos por analizadores y planes pedagógicos deterministas.",
      "evidence": "docs/music-practice-teacher.md:11-23",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "Reproducción confirmada por el usuario",
      "detail": "Las acciones propuestas por el profesor se validan, se presentan y requieren confirmación antes de reproducir.",
      "evidence": "docs/music-practice-teacher.md:108-116",
      "confidence": "high"
    },
    {
      "type": "requirement",
      "title": "Notación legible y sincronizada",
      "detail": "El producto debe mostrar una partitura utilizable durante la reproducción.",
      "evidence": "README.md:43-49; docs/adr/0016-soundslice-as-ui-reference.md:1",
      "confidence": "high"
    },
    {
      "type": "requirement",
      "title": "Trazabilidad de la transcripción",
      "detail": "La importación debe conservar eventos raw, eventos normalizados, provenance, diagnósticos y note trace.",
      "evidence": "docs/audio-transcription-api.md:23-40; src/drumcoach_spike/transcription_pipeline.py:290-364",
      "confidence": "high"
    },
    {
      "type": "requirement",
      "title": "Biblioteca local de práctica",
      "detail": "El sistema debe conservar canciones, partes, revisiones y artefactos para reabrirlos.",
      "evidence": "README.md:45-49; src/drumcoach_app/repository.py:11-50",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Producto local y personal",
      "detail": "No es un servicio hospedado, multiusuario ni de producción.",
      "evidence": "README.md:1-3; docs/adr/0001-local-first-v1.md:1",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Licencia personal no comercial",
      "detail": "No se permite vender, hospedar como servicio, redistribuir o incorporar el proyecto sin permiso.",
      "evidence": "LICENSE:5-11",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Worker único y secuencial",
      "detail": "La ingestión usa un worker local y procesa una transcripción cada vez.",
      "evidence": "docs/adr/0034-single-local-ingestion-worker.md:1; src/drumcoach_app/main.py:205-287",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Duración máxima de audio",
      "detail": "La transcripción admite como máximo diez minutos de audio.",
      "evidence": "src/drumcoach_spike/audio_duration.py:10-16; src/drumcoach_app/main.py:1730-1733",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Imágenes sin PDF",
      "detail": "La importación de partituras admite PNG, JPEG y WebP, pero no PDF.",
      "evidence": "src/drumcoach_app/main.py:920-945",
      "confidence": "high"
    },
    {
      "type": "bounded-context",
      "title": "Ingestión y transcripción",
      "detail": "Agrupa fuentes, jobs, bundles, worker, MuScriptor, OMR y publicación inicial.",
      "evidence": "src/drumcoach_app/main.py:184-287; src/drumcoach_app/import_runner.py:82-401",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Partitura y artefactos",
      "detail": "Agrupa Practice Score, provenance, MusicXML, MIDI de reproducción, diagnósticos y engraving.",
      "evidence": "src/drumcoach_spike/transcription_pipeline.py:87-105; src/drumcoach_spike/transcription_pipeline.py:290-364",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Biblioteca y revisiones",
      "detail": "Agrupa canciones, partes, revisiones activas, artefactos y eliminación.",
      "evidence": "src/drumcoach_app/repository.py:11-50; src/drumcoach_app/main.py:1231-1306",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Práctica y reproducción",
      "detail": "Agrupa PlayerSession, PlayerController, rango, transporte, tempo, loop y fuentes de audio.",
      "evidence": "docs/generic-practice-player.md:1-31; src/drumcoach_app/player.py:316-564",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Asistente y profesor contextual",
      "detail": "Agrupa selección, análisis simbólico, pedagogía, LFM y acciones confirmadas.",
      "evidence": "docs/music-practice-teacher.md:11-23; src/drumcoach_app/main.py:626-779",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Exploración MIDI",
      "detail": "Ruta separada para explorar MIDI y DrumScore sin convertirla en la ingestión canónica normal.",
      "evidence": "src/drumcoach_app/main.py:505-569; docs/adr/0036-event-stream-first-transcription.md:1",
      "confidence": "medium"
    }
  ]
}
```

Incógnitas restantes: objetivo comercial futuro, identidad/usuarios más allá del uso individual, métrica de calidad aceptable y si el editor mínimo de correcciones debe convertirse en una capacidad web de producto.

Siguiente decisión útil: adoptar como baseline documental la superficie observable actual —producto local-first, Practice Score canónico, tres familias instrumentales, biblioteca, reproductor y asistente— y tratar el editor de correcciones como capacidad no confirmada hasta que exista un flujo HTTP/UI respaldado.
Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.
