✦
OMP
PRODUCTSHAPE — Pinto

Alcance y evidencia inicial

`docs/product` no existe en el repositorio inspeccionado. `docs/` contiene una salida generada de la aplicación (`index.html`, assets y service worker), no documentación de producto. La fuente documental disponible es `README.md`, corroborada con `src/`, `tests/` y `e2e/`.

Hechos observados

Propósito

Pinto es una PWA mobile-first que estima mezclas de óleo a partir de una foto de referencia, usando un catálogo fijo de óleos básicos Royal Talens Van Gogh.
• `README.md:3`
• `src/lib/mixing.ts:4-13`

La estimación se realiza en el dispositivo. Las fotos y resultados permanecen en el navegador; no hay servidor ni ruta de subida.
• `README.md:6-7`
• `src/lib/storage.ts:11-21`
• `src/main.tsx:5`

Actor

El único actor de negocio explícito es una persona que quiere reproducir o comparar un color de una imagen. La interfaz permite:
• tomar una foto con la cámara;
• elegir una foto;
• seleccionar un punto de color;
• guardar muestras;
• consultar mezclas anteriores;
• importar una foto de su mezcla para compararla.
• `src/App.tsx:379-392`
• `src/App.tsx:320-353`
• `e2e/app.spec.ts:70-140`

El navegador es una frontera técnica de ejecución, no un actor de negocio adicional.

Casos de uso confirmados

1. Cargar una foto de referencia
• Acepta JPEG, PNG, WebP y HEIC/HEIF decodificable.
• Normaliza la imagen y limita su dimensión máxima a 2560 píxeles.
• Guarda la última imagen localmente.
• `src/App.tsx:32-64`
• `src/App.tsx:185-218`

2. Explorar y muestrear la imagen
• Tap: selecciona un píxel exacto.
• Arrastre: desplaza la imagen.
• Pinch: aplica zoom entre `1×` y `8×`.
• El muestreo se mantiene acotado a los límites de la imagen.
• `src/App.tsx:247-317`
• `src/App.tsx:382-386`
• `src/lib/image-analysis.ts:9-30`

3. Generar una familia tonal
• Produce exactamente cinco tonos: `Highlight`, `Light`, `Base`, `Shadow`, `Deep Shadow`.
• Usa muestras contextuales alrededor del punto seleccionado.
• Interpola o extrapola tonos cuando la foto no aporta suficientes referencias.
• `src/lib/image-analysis.ts:59-117`
• `src/workers/analyser.worker.ts:5-6`

4. Generar recetas de mezcla
• Produce una receta `Simple` y otra `Complex`.
• Calcula las recetas con una mezcla ponderada en CIELAB y distancia CIEDE2000.
• Limita cada receta a un máximo de cuatro pinturas.
• `src/lib/mixing.ts:31-69`
• `src/lib/color.ts:14-19`

5. Guardar y recuperar resultados
• Persiste imagen, muestras, catálogo, configuración y la historia de mezclas en IndexedDB.
• Una muestra conserva su posición relativa respecto de la imagen de origen.
• Si la imagen de origen no está cargada, el resultado se puede consultar, pero no se muestra su ubicación.
• `src/lib/storage.ts:55-65`
• `src/App.tsx:320-371`

6. Comparar una mezcla fotografiada
• Toma la región central de una segunda foto.
• Informa diferencias de luminosidad y ejes cromáticos.
• Sugiere una adición sólo si alguna pintura del catálogo reduce el error.
• `src/App.tsx:337-353`
• `src/lib/image-analysis.ts:33-51,120-133`
• `src/lib/mixing.ts:72-81`

Reglas y restricciones
• Catálogo cerrado: sólo se permiten los diez colores definidos en `src/lib/mixing.ts:4-9`. La instantánea persistida es fija y no editable.
• Modelo de estimación: mezcla determinista en CIELAB; no representa comportamiento físico del pigmento, iluminación, opacidad ni un modelo Kubelka–Munk calibrado.
• `README.md:6-7`
• `src/lib/color.ts:14-19`
• Tonos: la familia debe mantener cinco niveles ordenados de luminosidad.
• `src/lib/image-analysis.ts:95-111`
• Receta simple: busca composiciones de cuatro unidades.
• `src/lib/mixing.ts:41-51`
• Receta compleja: refina composiciones de diez unidades.
• `src/lib/mixing.ts:54-64`
• Persistencia: sólo local, mediante IndexedDB; no hay backend.
• `src/lib/storage.ts:11-21`
• Privacidad: las imágenes no salen del dispositivo.
• `README.md:6-7`
• Concurrencia: los análisis obsoletos no se publican después de cambiar de imagen o selección.
• `src/App.tsx:123-143`
• `e2e/app.spec.ts:218-260`

Bounded contexts inferidos del código

Estos nombres no aparecen declarados como arquitectura formal; son límites funcionales observables en los módulos:

1. Referencia visual y muestreo
• `src/App.tsx`
• `src/lib/image-analysis.ts`
• Responsabilidad: cargar, normalizar, visualizar, navegar y muestrear imágenes.

2. Análisis cromático y familia tonal
• `src/lib/color.ts`
• `src/lib/image-analysis.ts`
• `src/workers/analyser.worker.ts`
• Responsabilidad: convertir RGB/XYZ/Lab, agrupar colores y derivar tonos.

3. Estimación de mezcla
• `src/lib/mixing.ts`
• Responsabilidad: buscar recetas dentro de `CATALOGUE`, calcular error y sugerir adiciones.

4. Memoria local de trabajo
• `src/lib/storage.ts`
• Responsabilidad: persistir última imagen, muestras, configuración, catálogo fijo e historial.

5. Comparación de mezcla
• `src/App.tsx:337-353`
• `src/lib/image-analysis.ts:120-133`
• Responsabilidad: comparar una foto de mezcla con el tono activo y producir orientación correctiva.

Incógnitas
• No existe una especificación en `docs/product` que defina visión, personas, prioridades o criterios de aceptación.
• No hay actores externos, roles de usuario ni permisos de negocio documentados.
• No hay objetivos explícitos de rendimiento, compatibilidad de navegadores, retención de datos o exportación.
• Los bounded contexts anteriores son una lectura arquitectónica del código, no una decisión formal registrada.

Vista Mermaid confirmada

Verificación

`npm run test` completó correctamente:
• 2 archivos de prueba;
• 12 pruebas;
• 0 fallos.

Siguiente decisión útil: ¿se toma esta vista inferida del código como baseline de arquitectura, o se prioriza crear `docs/product` para convertir estas inferencias en decisiones de producto explícitas?
Diagrama actualizado en el panel central · abre el mapa PDAC para verlo completo.
