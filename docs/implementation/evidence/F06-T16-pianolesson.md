✦
OMP
Objetivo actual

Determinar el producto vigente a partir de documentación existente y corroborarlo con el código, separando alcance confirmado, inferencias y huecos.

Fuentes consultadas
• `docs/product/`: no existe en el repositorio.
• Documentación sustitutiva disponible:
• `planPiano.md`
• `README.md`
• `architecture.md`
• `docs/goals/`
• Después, código de `app/` y `piano_coach/`.

Tres observaciones de alineación

1. Falta la fuente documental solicitada. El propósito y el roadmap están repartidos entre `planPiano.md`, `README.md`, `architecture.md` y los objetivos históricos. `README.md:140-148` enumera esa estructura, pero no existe un contrato actual bajo `docs/product/`.

2. Hay funciones anunciadas que no están confirmadas en la implementación actual. El plan incluye pegar imágenes, inversiones, fingerings y guided practice (`planPiano.md:139-180`, `planPiano.md:517-613`, `planPiano.md:672-725`). El pegado todavía lanza explícitamente `not implemented` en `app/electron/main.ts:189-193`; el análisis armónico también declara que no detecta inversiones ejecutadas en `piano_coach/piano_coach/chords.py:13-24`.

3. El plan promete reproducción audible, pero el código actual confirma sincronización visual, no audio. `planPiano.md:341-346` describe repetición visual y audible; `app/src/lib/playbackScheduler.ts:16-20` indica que la salida de audio queda para otra ronda.

Propósito

Hecho documental

El producto es una aplicación Electron local-first que convierte una imagen de partitura escaneada en una experiencia interactiva de aprendizaje de piano:

> escanear una partitura, ver su correspondencia con el piano, comprender acordes, repetir compases difíciles y practicar paso a paso sin depender de MIDI.

Evidencia:
• `planPiano.md:3-13`
• `planPiano.md:17-47`
• `planPiano.md:1585-1601`
• `README.md:1-3`, `README.md:11-18`

Corroboración en código

La implementación actual soporta:
• Importación de imágenes desde selector y drag-and-drop.
• OMR local con HOMR.
• Conversión a MusicXML y eventos normalizados.
• Biblioteca local con búsqueda y reapertura.
• Partitura renderizada con OSMD.
• Piano sincronizado con la línea temporal.
• Acordes, anotaciones armónicas y arpegios.
• Loop de compases, tempo reducido y selección de mano.
• Integración MIDI opcional y validación visual.

Evidencia:
• `app/src/components/ImportDropZone.tsx:1-45`
• `piano_coach/piano_coach/importer.py:1-155`
• `app/src/App.tsx:288-307`
• `app/src/App.tsx:380-415`
• `app/src/App.tsx:843-998`
• `app/src/lib/midi.ts:1-129`

Actores

Actor principal confirmado

Persona aprendiz de piano

Puede:
• importar una partitura;
• buscar y reabrir partituras procesadas;
• leer la partitura renderizada;
• reproducirla y avanzar o retroceder;
• observar teclas resaltadas;
• cambiar velocidad y mano;
• seleccionar un loop;
• consultar acordes y arpegios;
• usar MIDI si dispone de teclado compatible.

Evidencia:
• `planPiano.md:51-83`
• `app/src/components/LibraryView.tsx:40-129`
• `app/src/components/TransportControls.tsx:80-191`
• `app/src/components/ArpeggiosScreen.tsx:43-124`

Actor opcional confirmado

Teclado MIDI

Aporta entrada de notas, selección de dispositivo y feedback de notas esperadas, pero no es requisito para usar el producto.

Evidencia:
• `planPiano.md:51-83`
• `app/src/App.tsx:339-378`
• `app/src/lib/midi.ts:44-129`

Participantes técnicos

No son actores de negocio, sino partes del sistema:
• proceso Electron principal;
• renderer React;
• sidecar FastAPI;
• HOMR;
• parser MusicXML;
• almacenamiento local;
• OSMD.

Sus responsabilidades están descritas en:
• `architecture.md:49-103`
• `app/electron/main.ts:1-15`
• `piano_coach/piano_coach/api.py:1-14`

Casos de uso

| Caso de uso | Estado corroborado |
|---|---|
| Importar imagen mediante selector | Confirmado en `app/electron/main.ts:162-178` |
| Importar mediante drag-and-drop | Confirmado en `app/src/components/ImportDropZone.tsx:24-45` |
| Ejecutar OMR local y generar MusicXML | Confirmado en `piano_coach/piano_coach/importer.py:79-105` |
| Extraer notas, silencios, acordes y arpegios | Confirmado en `piano_coach/piano_coach/importer.py:103-124` |
| Consultar progreso de importación | Confirmado en `piano_coach/piano_coach/api.py:86-132` y `app/src/App.tsx:380-427` |
| Buscar partituras locales | Confirmado en `piano_coach/piano_coach/library.py:150-173` |
| Reabrir una partitura sin repetir OMR | Confirmado en `app/src/App.tsx:492-537` |
| Renombrar y eliminar partituras | Confirmado en `app/src/App.tsx:475-490` y `piano_coach/piano_coach/library.py:121-147` |
| Leer la partitura y sincronizar piano/cursor | Confirmado en `app/src/lib/music/projections.ts:140-153` y `app/src/App.tsx:314-320` |
| Reproducir, pausar, cambiar tempo y navegar | Confirmado en `app/src/components/TransportControls.tsx:80-191` |
| Repetir compases | Confirmado en `app/src/lib/playbackScheduler.ts:134-143`, `app/src/components/TransportControls.tsx:133-176` |
| Consultar acordes | Confirmado en `app/src/App.tsx:885-910` y `app/src/lib/music/projections.ts:281-336` |
| Consultar arpegios y practicar por pasos | Confirmado en `app/src/components/ArpeggiosScreen.tsx:99-123` |
| Usar entrada MIDI opcional | Parcialmente confirmado: conexión y feedback visual están implementados; no hay evidencia de puntuación persistida de sesiones |
| Pegar imagen desde portapapeles | Declarado en el plan, no implementado en `app/electron/main.ts:189-193` |
| Inversiones ejecutadas | Declarado en el plan, no corroborado; el detector actual lo excluye explícitamente |
| Fingerings y guided practice | Declarados en el plan, sin superficie implementada corroborada |

Bounded contexts

El repositorio no nombra explícitamente estos bounded contexts. La siguiente división es una inferencia arquitectónica basada en límites de módulos, datos y responsabilidades existentes.

1. Ingesta y reconocimiento de partitura

Responsabilidad:
• recibir una imagen;
• copiarla al almacenamiento local;
• ejecutar HOMR;
• producir y postprocesar MusicXML;
• publicar estados de procesamiento.

Límites observados:
• `piano_coach/piano_coach/api.py:86-114`
• `piano_coach/piano_coach/importer.py:53-105`
• `piano_coach/piano_coach/omr.py`
• `piano_coach/piano_coach/musicxml_post.py`

2. Biblioteca y persistencia local

Responsabilidad:
• conservar artefactos de una partitura;
• indexar resúmenes;
• buscar, renombrar, reabrir y eliminar.

Límites observados:
• `piano_coach/piano_coach/storage.py:24-84`
• `piano_coach/piano_coach/library.py:1-173`
• `piano_coach/piano_coach/api.py:80-84`, `155-171`

La carpeta de cada score es la fuente de verdad; `library_index.json` es una caché de búsqueda. Esto está explícito en `piano_coach/piano_coach/library.py:1-7`.

3. Modelo musical y línea temporal

Responsabilidad:
• normalizar notas y silencios;
• representar ticks, compases, voces y pentagramas;
• resolver eventos activos según `currentTick`;
• alimentar las proyecciones de las vistas.

Límites observados:
• `app/src/lib/music/songModel.ts:93-203`
• `app/src/lib/music/timelineEngine.ts`
• `app/src/lib/music/projections.ts:108-153`
• `architecture.md:309-315`

4. Lectura y práctica visual

Responsabilidad:
• renderizar MusicXML;
• mostrar cursor;
• mostrar piano;
• controlar reproducción, tempo, manos y loops.

Límites observados:
• `app/src/App.tsx:843-998`
• `app/src/components/ScoreSheet.tsx`
• `app/src/components/PianoKeyboard.tsx`
• `app/src/components/TransportControls.tsx`
• `app/src/lib/playbackScheduler.ts:1-25`

5. Análisis armónico y lecciones de arpegios

Responsabilidad:
• generar acordes persistidos;
• analizar armonía en el tick actual;
• preparar anotaciones de partitura;
• detectar patrones de arpegio y presentarlos como lecciones.

Límites observados:
• `piano_coach/piano_coach/chords.py:1-34`
• `piano_coach/piano_coach/arpeggios.py:1-7`
• `app/src/lib/music/chordAnalysisService.ts`
• `app/src/lib/music/projections.ts:198-279`
• `app/src/components/ArpeggiosScreen.tsx:1-13`

6. Entrada MIDI opcional

Responsabilidad:
• detectar soporte Web MIDI;
• listar entradas;
• recibir note-on/note-off;
• comparar notas interpretadas con notas esperadas.

Límites observados:
• `app/src/lib/midi.ts:44-129`
• `app/src/App.tsx:339-378`

Reglas de negocio y arquitectura

Reglas confirmadas

1. MIDI no es una dependencia. La experiencia visual debe funcionar sin teclado MIDI.  
   `planPiano.md:51-83`; `architecture.md:205-211`.

2. La línea temporal debe ser única. Piano, partitura, acordes, práctica y loops derivan del mismo `SongModel`, `TimelineEngine` y `currentTick`.  
   `app/src/lib/music/projections.ts:140-153`; `architecture.md:309-315`.

3. Los eventos canónicos son ticks, pero el scheduler conserva compatibilidad con segundos.  
   `app/src/lib/music/songModel.ts:3-6`, `116-126`; `architecture.md:309-312`.

4. El MusicXML almacenado no se modifica para añadir anotaciones de renderizado. La anotación se produce al servirlo para OSMD.  
   `piano_coach/piano_coach/api.py:249-274`; `architecture.md:269-275`.

5. La eliminación está confirmada y acotada al directorio local del score.  
   `app/src/App.tsx:485-490`; `piano_coach/piano_coach/library.py:135-147`.

6. Las importaciones se serializan. Existe un único `asyncio.Lock`; no se procesan importaciones concurrentes.  
   `piano_coach/piano_coach/api.py:69-72`, `101-114`.

Restricciones técnicas confirmadas
• Python `>=3.11,<3.13`: `piano_coach/pyproject.toml:1-8`.
• HOMR fijado a `0.6.2`: `piano_coach/pyproject.toml:11-19`.
• Sidecar local FastAPI en `127.0.0.1`, normalmente desde el puerto `8765`: `app/electron/main.ts:25-31`, `42-90`.
• Almacenamiento por defecto bajo `~/Library/Application Support/PianoOMRCoach`: `piano_coach/piano_coach/storage.py:24-37`.
• El parser actual procesa sólo la primera parte de un score multiparte: `piano_coach/piano_coach/parser.py:241-259`.
• El parser usa 120 BPM por defecto cuando no hay tempo explícito: `piano_coach/piano_coach/parser.py:8-16`, `35-36`.
• La asignación de mano del parser parte de `right`; el modelo puede inferir izquierda por pentagrama 2: `piano_coach/piano_coach/parser.py:19-21`, `app/src/lib/music/songModel.ts:205-209`.
• La licencia AGPL de HOMR sigue siendo una decisión abierta para distribución: `architecture.md:333-337`; `README.md:154-156`.

Diagrama confirmado

Incógnitas relevantes
• `docs/product/` no existe; no hay una fuente única que distinga producto vigente de roadmap.
• No está definido si `planPiano.md` debe tratarse como contrato actual o como visión histórica.
• La reproducción audible no está corroborada en el código actual.
• No hay un modelo persistido de sesiones de práctica ni evidencia de progreso acumulado.
• La estrategia de distribución compatible con AGPL sigue abierta.
• La detección actual de acordes no equivale a detección fiable de inversiones ejecutadas.

Siguiente decisión única

¿Se adopta `planPiano.md` como plan histórico y se crea `docs/product/` como fuente vigente, separando explícitamente producto actual, roadmap y huecos de implementación?
Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.
