✦
OMP
Objetivo actual

Construir una vista brownfield-discovery del producto real, separando hechos observados, inferencias y vacíos.

`docs/product` no existe en el repositorio. La evidencia de producto disponible está en `SPEC.md`, ADRs y documentación operativa; después fue contrastada con `src/`.

Observación 1 — Propósito y propuesta de valor

Hecho. DrumCoach permite que un aprendiz aporte una grabación, seleccione partes instrumentales y obtenga una partitura de práctica fiel, legible y reproducible. El `Practice Score` es el artefacto canónico; MusicXML y MIDI son proyecciones derivadas. Evidencia: `SPEC.md:3-19,54-79`, `docs/adr/0002-practice-score-canonical-artifact.md:1-2`.

Corroboración en código.
• Las fuentes admitidas incluyen audio local, URLs de NAS library, eventos crudos e imágenes de partitura: `src/drumcoach_app/repository.py:100-103,225-255`.
• La importación produce eventos crudos, `practice-score.json`, MusicXML, reproducción generada, procedencia y trazas de notas: `src/drumcoach_app/import_runner.py:426-529`.
• La biblioteca persiste canciones, partes instrumentales y revisiones de `Practice Score`: `src/drumcoach_app/repository.py:11-50,188-223`.
• El endpoint de MusicXML mantiene al `Practice Score` como fuente autoritativa: `src/drumcoach_app/main.py:1308-1362`.

Inferencia. El producto no es principalmente un editor de partituras ni un reproductor genérico: su núcleo es ingestión musical → representación canónica fiel → práctica guiada.

Observación 2 — Actores, journey y contextos de negocio

Actores
• Aprendiz/músico. Aporta una canción, elige instrumento, abre una parte, practica rangos y solicita ayuda contextual. `SPEC.md:21-30`; `docs/generic-practice-player.md:51-59`; `docs/music-practice-teacher.md:5-19`.
• Desarrollador u operador local. Ejecuta el producto en local, conserva fuentes y artefactos, configura modelos y diagnostica importaciones. `SPEC.md:31-50,54-85`; `docs/voice.md:15-49`.

Journey confirmado

1. El aprendiz aporta una `Source Recording` local, una URL de NAS library o una imagen de partitura.
2. El sistema crea un `Import Bundle` con `Import Job` por instrumento, o un job independiente.
3. La transcripción queda restringida al instrumento solicitado.
4. Se genera una `Practice Score Revision` bajo una `Song` y una `Instrument Part`.
5. Se publican MusicXML, playback y artefactos de procedencia.
6. El aprendiz abre la parte desde la biblioteca.
7. `PlayerController` gestiona rango, reproducción, tempo, loop, metrónomo y fuente de audio.
8. El profesor contextual analiza únicamente el rango seleccionado y propone acciones reproducibles.

Evidencia: `src/drumcoach_app/main.py:879-1121`; `src/drumcoach_app/import_runner.py:192-235,319-394,426-594`; `docs/generic-practice-player.md:3-31`; `docs/music-practice-teacher.md:11-23`.

Bounded contexts — propuesta draft

Son límites de dominio inferidos, no microservicios desplegados:

1. Adquisición e ingestión. Fuentes, jobs, bundles, perfiles instrumentales, transcripción y OMR.
2. Biblioteca y score. `Song`, `Instrument Part`, revisiones activas y artefactos canónicos.
3. Notación y playback. MusicXML, MuseScore, MIDI cuantizado y reproducción generada.
4. Práctica y transporte. Sesión del reproductor, rango de compases, tempo, loop, metrónomo y audio original.
5. Tutoría contextual y asistente. Análisis simbólico determinista, plan pedagógico, explicación local y acciones validadas.

Evidencia: `src/drumcoach_app/repository.py:11-87`; `docs/per-instrument-scores.md:35-40,61-105`; `docs/generic-practice-player.md:11-31,51-59`; `docs/music-practice-teacher.md:11-23,93-125`.

Vista Mermaid confirmada

Observación 3 — Reglas, requisitos, restricciones y huecos

Reglas de negocio observadas
• `Practice Score` es la fuente canónica; MusicXML y MIDI no pueden sustituirla. `SPEC.md:66-79`; `docs/adr/0002-practice-score-canonical-artifact.md:1-2`.
• Cada importación queda restringida a una familia instrumental: batería, teclado o guitarra. `SPEC.md:63-65`; `src/drumcoach_app/repository.py:100-103`; `src/drumcoach_spike/transcription_adapter.py:18-36`.
• Los eventos ambiguos o no soportados se conservan como procedencia y se excluyen de la notación reproducible por defecto. `SPEC.md:27-30,75-77`; `src/drumcoach_spike/practice_score.py:99-115`.
• La corrección modifica una partitura generada; no habilita autoría general ni composición. `docs/adr/0017-correction-not-authoring.md:1-2`; `src/drumcoach_spike/corrections.py:8-14`.
• El análisis del profesor es determinista; el LFM sólo reexpresa hechos verificados y las acciones de playback requieren confirmación. `docs/music-practice-teacher.md:11-23,106-125`.
• Entrar al reproductor no inicia sonido automáticamente. `docs/generic-practice-player.md:70-78`.

Requisitos funcionales
• Importar desde audio local, NAS library y captura de partitura. `docs/adr/0018-source-recordings-from-youtube-and-files.md:1-3`; `src/drumcoach_app/main.py:879-968`.
• Generar partes instrumentales independientes y reintentables. `docs/adr/0010-instrument-specific-ingestion.md:1-3`; `src/drumcoach_app/repository.py:380-430`.
• Mantener revisiones de score y seleccionar una revisión activa. `src/drumcoach_app/repository.py:627-714`; `src/drumcoach_app/main.py:1501-1518`.
• Practicar por rango de compases con tempo, loop, metrónomo, count-in y selección de fuente de playback. `src/drumcoach_app/player.py:25-34,412-546`.
• Pedir análisis rítmico, armónico, de manos y fretboard sobre un rango seleccionado. `docs/music-practice-teacher.md:25-42,93-104`.
• Usar voz como otra interfaz del mismo asistente, sin duplicar la lógica de player. `docs/voice.md:1-13`; `src/drumcoach_app/main.py:626-667`.

Restricciones técnicas y de producto
• Producto local-first y privado; no hay evidencia de autenticación, hosting público o sincronización cloud como alcance actual. `docs/adr/0001-local-first-v1.md:1-2`.
• Las importaciones de audio están limitadas a diez minutos. `src/drumcoach_spike/audio_duration.py:10-16,54-69`.
• Las cargas de audio están limitadas a 100 MB; las imágenes de partitura a 25 MB y PDF no está soportado. `src/drumcoach_app/main.py:889-900,930-944,1028-1039`.
• La voz no persiste audio crudo; la captura se procesa en loopback y se elimina después de STT. `docs/voice.md:3-8,76-88`.
• El asistente opera con un modelo local y red externa desactivada por configuración. `src/drumcoach_app/assistant/assistant_config.py:8-18`.
• MuseScore 4 es una capacidad opcional de engravado; si falta, se conserva la proyección interna de MusicXML y se registra el motivo. `docs/per-instrument-scores.md:61-103`.

Contradicciones o huecos detectados

1. Fuente documental principal ausente. `docs/product` no existe; por tanto, el producto debe reconstruirse desde una especificación de milestone y documentos técnicos.
2. La `SPEC.md` mezcla el spike inicial con el producto posterior. Declara fuera de alcance FastAPI, base de datos, frontend, player y teacher (`SPEC.md:106-133`), pero esos flujos ya existen en `src/drumcoach_app/main.py:626-840,870-1518`. La interpretación más fuerte es que `SPEC.md` describe una fase histórica, no el estado actual completo.
3. La restricción “sólo 4/4” quedó superada o acotada al milestone inicial. `SPEC.md:69-71` la declara para v1 inicial; el código actual parsea firmas arbitrarias y las usa para calcular compases (`src/drumcoach_spike/models.py:33-60`; `src/drumcoach_app/import_runner.py:426-448`). Debe marcarse como restricción histórica de milestone, no como regla actual global.

Incógnitas
• No hay evidencia de objetivos de negocio, métricas de éxito, pricing, personas secundarias o política de soporte.
• No está documentado en `docs/product` qué flujo —bundle de tres partes o importación de una sola familia— es el camino recomendado para el usuario.
• No queda explícito si el alcance futuro incluye multiusuario, sincronización entre dispositivos o publicación remota.

```json
{
  "pdac": [
    {
      "type": "actor",
      "title": "Aprendiz o músico",
      "detail": "Aporta una canción, selecciona un instrumento y practica el material generado.",
      "evidence": "SPEC.md:21-30",
      "confidence": "high"
    },
    {
      "type": "actor",
      "title": "Desarrollador u operador local",
      "detail": "Ejecuta, configura y diagnostica el producto local y sus modelos.",
      "evidence": "SPEC.md:31-50,54-85",
      "confidence": "medium"
    },
    {
      "type": "use-case",
      "title": "Importar una source recording",
      "detail": "Incorporar audio local, URL de NAS library, eventos crudos o imagen de partitura.",
      "evidence": "src/drumcoach_app/repository.py:100-103,225-255",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Seleccionar partes instrumentales",
      "detail": "Crear jobs independientes para batería, teclado y guitarra.",
      "evidence": "docs/adr/0010-instrument-specific-ingestion.md:1-3",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Generar una Practice Score fiel",
      "detail": "Transformar eventos transcritos en una revisión canónica conservando detalle y procedencia.",
      "evidence": "SPEC.md:3-19,25-30,66-79",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Consultar la biblioteca",
      "detail": "Listar canciones, abrir una canción y consultar sus partes y revisiones.",
      "evidence": "src/drumcoach_app/main.py:1231-1306",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Practicar por rango",
      "detail": "Seleccionar compases y reproducirlos con tempo, loop, metrónomo y count-in.",
      "evidence": "src/drumcoach_app/player.py:412-546",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Corregir una partitura generada",
      "detail": "Eliminar falsos positivos u sobrescribir voces sin convertir el sistema en autor de notación.",
      "evidence": "src/drumcoach_spike/corrections.py:8-14",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Solicitar tutoría contextual",
      "detail": "Analizar un rango seleccionado y recibir una explicación y acciones de práctica validadas.",
      "evidence": "docs/music-practice-teacher.md:5-23,93-125",
      "confidence": "high"
    },
    {
      "type": "use-case",
      "title": "Interactuar por voz",
      "detail": "Usar voz como entrada y salida del mismo flujo de assistant/turn.",
      "evidence": "docs/voice.md:1-13,76-88",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Source Recording",
      "detail": "Grabación o fuente musical que origina la importación.",
      "evidence": "SPEC.md:3-19; docs/adr/0018-source-recordings-from-youtube-and-files.md:1-3",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Song",
      "detail": "Entidad que agrupa la fuente y sus partes instrumentales.",
      "evidence": "src/drumcoach_app/repository.py:11-19,188-195",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Instrument Part",
      "detail": "Parte tocable de una canción para un instrumento concreto.",
      "evidence": "SPEC.md:63-65; src/drumcoach_app/repository.py:30-36,205-211",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Import Bundle",
      "detail": "Agrupación de una fuente y sus jobs instrumentales hijos.",
      "evidence": "src/drumcoach_app/repository.py:52-63,380-430",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Import Job",
      "detail": "Unidad persistida de trabajo para adquirir, transcribir y publicar una parte.",
      "evidence": "src/drumcoach_app/repository.py:65-87,237-255",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Practice Score",
      "detail": "Modelo canónico de material practicable y de su tiempo musical.",
      "evidence": "docs/adr/0002-practice-score-canonical-artifact.md:1-2; src/drumcoach_spike/practice_score.py:99-115",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Practice Score Revision",
      "detail": "Versión persistida de una partitura asociada a una parte instrumental.",
      "evidence": "src/drumcoach_app/repository.py:39-50,627-714",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Rendered Notation",
      "detail": "Proyección legible derivada del score, principalmente MusicXML y engravado.",
      "evidence": "SPEC.md:49-51,77-79; src/drumcoach_app/main.py:1308-1362",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Generated Playback",
      "detail": "Playback derivado del score, separado de la fuente canónica.",
      "evidence": "SPEC.md:34-35; src/drumcoach_app/import_runner.py:513-519",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Practice Range",
      "detail": "Rango inclusivo de compases seleccionado para practicar o analizar.",
      "evidence": "docs/generic-practice-player.md:51-59",
      "confidence": "high"
    },
    {
      "type": "domain-term",
      "title": "Transcription Adapter",
      "detail": "Frontera que desacopla la API de MuScriptor del modelo de dominio.",
      "evidence": "SPEC.md:31-33,60-62; src/drumcoach_spike/transcription_adapter.py:39-44",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "El Practice Score es canónico",
      "detail": "MIDI y MusicXML son artefactos derivados y regenerables.",
      "evidence": "SPEC.md:66-79; docs/adr/0002-practice-score-canonical-artifact.md:1-2",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "La transcripción es específica por instrumento",
      "detail": "Los jobs no publican salida full-band mezclada en una parte.",
      "evidence": "docs/adr/0010-instrument-specific-ingestion.md:1-3; src/drumcoach_spike/transcription_adapter.py:18-36",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "La procedencia no se pierde",
      "detail": "Eventos no soportados permanecen registrados aunque no sean reproducibles como voces canónicas.",
      "evidence": "SPEC.md:27-30,75-77; src/drumcoach_spike/practice_score.py:110-115",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "Corrección, no autoría",
      "detail": "La edición está limitada a corregir material generado.",
      "evidence": "docs/adr/0017-correction-not-authoring.md:1-2",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "El profesor no inventa hechos musicales",
      "detail": "El análisis es determinista y el LFM sólo reexpresa hechos respaldados.",
      "evidence": "docs/music-practice-teacher.md:11-23",
      "confidence": "high"
    },
    {
      "type": "business-rule",
      "title": "Playback pedagógico con confirmación",
      "detail": "Una acción propuesta queda pendiente hasta que el aprendiz la confirma.",
      "evidence": "docs/music-practice-teacher.md:106-116",
      "confidence": "high"
    },
    {
      "type": "requirement",
      "title": "Producto local-first y privado",
      "detail": "La primera versión se orienta a práctica personal y almacenamiento local.",
      "evidence": "docs/adr/0001-local-first-v1.md:1-2",
      "confidence": "high"
    },
    {
      "type": "requirement",
      "title": "Importación de fuentes heterogéneas",
      "detail": "El producto debe converger desde NAS library y archivos locales hacia el mismo pipeline.",
      "evidence": "docs/adr/0018-source-recordings-from-youtube-and-files.md:1-3",
      "confidence": "high"
    },
    {
      "type": "requirement",
      "title": "Reproducción instrumental compartida",
      "detail": "Un único PlayerController sirve batería, piano y guitarra mediante adaptadores.",
      "evidence": "docs/generic-practice-player.md:3-9,21-31",
      "confidence": "high"
    },
    {
      "type": "requirement",
      "title": "Tutoría contextual acotada",
      "detail": "El teacher analiza sólo la selección y un contexto musical limitado.",
      "evidence": "docs/music-practice-teacher.md:25-47,225-230",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Duración máxima de audio",
      "detail": "Las fuentes de transcripción no pueden superar diez minutos.",
      "evidence": "src/drumcoach_spike/audio_duration.py:10-16,54-69",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Familias instrumentales admitidas",
      "detail": "La persistencia reconoce drums, keyboard y guitar.",
      "evidence": "src/drumcoach_app/repository.py:100-103",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Voz en loopback sin audio persistido",
      "detail": "La captura de micrófono se procesa localmente y se elimina tras transcripción.",
      "evidence": "docs/voice.md:3-8,76-88",
      "confidence": "high"
    },
    {
      "type": "constraint",
      "title": "Restricción histórica de 4/4",
      "detail": "La SPEC inicial la declara, pero la implementación actual parsea y calcula otras firmas; debe tratarse como restricción de milestone, no global.",
      "evidence": "SPEC.md:69-71; src/drumcoach_spike/models.py:33-60; src/drumcoach_app/import_runner.py:426-448",
      "confidence": "high"
    },
    {
      "type": "bounded-context",
      "title": "Adquisición e ingestión",
      "detail": "Draft: concentra fuentes, jobs, bundles, perfiles, transcripción y OMR.",
      "evidence": "src/drumcoach_app/main.py:879-1121; src/drumcoach_app/import_runner.py:192-235,319-394",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Biblioteca y score",
      "detail": "Draft: concentra Song, Instrument Part, revisiones y selección de artefacto activo.",
      "evidence": "src/drumcoach_app/repository.py:11-50,593-714",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Notación y playback",
      "detail": "Draft: concentra MusicXML, engravado, MIDI cuantizado y playback generado.",
      "evidence": "docs/per-instrument-scores.md:61-103; src/drumcoach_app/import_runner.py:513-548",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Práctica y transporte",
      "detail": "Draft: concentra sesión del reproductor, rango, tempo, loop, metrónomo y fuentes de audio.",
      "evidence": "docs/generic-practice-player.md:3-9,51-59; src/drumcoach_app/player.py:132-176,412-546",
      "confidence": "medium"
    },
    {
      "type": "bounded-context",
      "title": "Tutoría contextual y asistente",
      "detail": "Draft: concentra análisis simbólico, plan pedagógico, conversación local y acciones validadas.",
      "evidence": "docs/music-practice-teacher.md:11-23,93-125; src/drumcoach_app/main.py:626-779",
      "confidence": "medium"
    }
  ]
}
```

Siguiente decisión útil: ¿se adopta `SPEC.md` como documento histórico del spike y se toma esta vista actual como base para crear la futura documentación canónica bajo `docs/product`?
Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.
