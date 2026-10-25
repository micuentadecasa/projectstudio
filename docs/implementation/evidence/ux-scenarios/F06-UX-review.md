{
  "mode": "real-omp",
  "brownfield": [
    {
      "id": "F06-UX-B01-notes-loaded",
      "screenshot": "docs/implementation/evidence/ux-scenarios/F06-UX-B01-notes-loaded.png",
      "activeTab": "◇ProductShape×",
      "center": "notes\n/\nActores\nOMP real · cwd activo\n◎\n0\n♙\n6\n◇\n10\n◈\n17\n↝\n53\n§\n9\n✓\n13\n◌\n10\nGUARDADO\nRevisar\nVISTA ESTÁTICA · EVIDENCIA PDAC\nActores\n6 hallazgos visible\nActualizar actores\n← Estado general\nMAPA PDAC · EVIDENCIA\nMapa editable de hallazgos\nLIVE\nLIENZO PDAC · OFFLINE\nArrastra, edita y añade detalles. Se guarda en este dispositivo.\n\nResultado\n\nObjetivo actual: delimitar el producto vigente a par\n\nHallazgos verificables\n\nPropósito\n\n`docs/product/architecture.md:5-9,34-40`\n\n`docs/product/model/business-rules/br-local-first.md\n\n`src/drumcoach_app/main.py:879-1010,1231-1460`\n\nActores\n\nMove focus to canvas\nPage 1\n76%\nActualizar mapa de actores\n→\nDETALLE DINÁMICO\nActores\nVer estado\n01\nHECHO\nActor: Learner · estado draft · evidencia docs/product/model/actors/act-learner.md\nHallazgo publicado por el asistente. · docs/product/model/actors/act-learner.md\n02\nHECHO\nActor: Local operator · estado draft · evidencia docs/product/model/actors/act-local-operator.md\nHallazgo publicado por el asistente. · docs/product/model/actors/act-local-operator.md\n03\nHECHO\nActor: MuScriptor transcription engine · estado draft · evidencia docs/product/model/actors/act-muscriptor.md\nHallazgo publicado por el asistente.",
      "chat": "HOY · SESIÓN ACTIVA\n✦\nOMP\nHe cargado 53 elementos del PDAC que vive en el proyecto. Esa documentación es la fuente de verdad.",
      "suggestions": "Foco actual · Actores\nRefinar actores\nSiguiente: propósito",
      "checks": {
        "centralSurfaceVisible": true,
        "diagramSurfaceVisible": true,
        "chatHasNoInternalPrompt": true,
        "statusIsSingleSource": true,
        "chatAndCenterAgreeOnProductSurface": true
      }
    },
    {
      "id": "F06-UX-B02-notes-after-omp",
      "screenshot": "docs/implementation/evidence/ux-scenarios/F06-UX-B02-notes-after-omp.png",
      "activeTab": "◇ProductShape×",
      "center": "notes\n/\nActores\nOMP real · cwd activo\n◎\n2\n♙\n12\n◇\n4\n◈\n15\n↝\n47\n§\n10\n✓\n13\n◌\n10\nGUARDADO\nRevisar\nVISTA ESTÁTICA · EVIDENCIA PDAC\nActores\n12 hallazgos visible\nActualizar actores\n← Estado general\nMAPA PDAC · EVIDENCIA\nMapa editable de hallazgos\nLIVE\nLIENZO PDAC · OFFLINE\nArrastra, edita y añade detalles. Se guarda en este dispositivo.\nActualizar mapa de actores\n→\nDETALLE DINÁMICO\nActores\nVer estado\n01\nHECHO\nObjetivo actual\nDelimitar únicamente los actores humanos y los sistemas externos, con responsabilidades verificadas contra `docs/product` y el código.\n02\nHECHO\nEl aprendiz selecciona fuentes, instrumento, revisa partituras y practica: `docs/product/model/actors/act-learner.md:13-24`.\n2. Las responsabilidades externas quedan separadas por flujo. · docs/product/model/actors/act-learner.md:13-24\n03\nHECHO\nEl operador instala dependencias, configura rutas, inicia app/worker e inspecciona artefactos: `docs/product/model/actors/act-local-operator.md:13-24`, `scripts/run-local-app.sh:81-93`.\n2. Las responsabilidades externas quedan separadas por flujo. · docs/product/model/actors/act-local-operator.md:13-24\n04\nHECHO\nSeparación explícita del operador entre API y worker.\nSe regeneró también `gr",
      "chat": "no está disponible: `src/drumcoach_app/import_runner.py:680-798`.\n• Voz y asistente permanecen locales: Whisper recibe WAV, AVSpeech recibe texto sanitizado y LFM opera detrás de `/assistant/turn`: `src/drumcoach_app/main.py:370-411,626-667`, `docs/voice.md:1-13`.\n\n3. El diagrama anterior mezclaba responsabilidades de ingestión.\n• No todos los trabajos del worker pasan por MuScriptor: las imágenes siguen la frontera OMR.\n• Ajusté esa relación para limitar MuScriptor a audio retenido y mantener OMR como sistema externo independiente.\n\nDiagrama actualizado\n\nActualizado `docs/product/architecture.md:11-52`.\n\nCambios confirmados:\n• Separación explícita del operador entre API y worker.\n• MuScriptor limitado a transcripción de audio y exploración MIDI directa.\n• OMR descrito como entrada de imagen y salida MusicXML.\n• Voz, LFM, MuseScore, LRCLIB y YouTube expresados como responsabilidades concretas.\n• Sin añadir FFmpeg, SoundFont, AlphaTab ni bibliotecas locales como actores; el propio documento los clasifica como dependencias o proyecciones sin responsabilidad de producto independiente: `docs/product/architecture.md:49-52`.\n\nSe regeneró también `graphify-out/` después del cambio documental. Los cambios previos ajenos en código, tests, `AGENTS.md` y `uv.lock` quedaron intactos.\n\nIncógnita relevante\n\nEl actor OMR está correctamente modelado de forma genérica, pero el proveedor concreto no es estable entre entornos: el launcher configura HOMR y el adaptador admite Audiveris u otro comando. No conviene convertir todavía ese nodo en un producto específico.\n\nSiguiente decisión útil: decidir si `Learner` y `Local operator` deben permanecer como roles conceptuales separados —recomendado para responsabilidades— o documentarse como un único actor operativo en el escenario single-user.",
      "suggestions": "Foco actual · Actores\nRefinar actores",
      "checks": {
        "centralSurfaceVisible": true,
        "diagramSurfaceVisible": true,
        "chatHasNoInternalPrompt": true,
        "statusIsSingleSource": true,
        "chatAndCenterAgreeOnProductSurface": true
      }
    }
  ],
  "greenfield": [
    {
      "id": "F06-UX-G01-greenfield-ready",
      "screenshot": "docs/implementation/evidence/ux-scenarios/F06-UX-G01-greenfield-ready.png",
      "activeTab": "◇ProductShape×",
      "center": "ux-greenfield-biblioteca\n/\nProductShape\nOMP real · cwd activo\n◎\n0\n♙\n0\n◇\n0\n◈\n0\n↝\n0\n§\n0\n✓\n0\n◌\n0\nGUARDADO\nEmpezar\nMAPA PDAC · ESPERANDO EVIDENCIA\nEl mapa aparecerá aquí\nLIVE\n◇\nTodavía no hay un diagrama publicado\nRevisar y diagramar inicia el análisis con evidencia real.\nActualizar mapa con OMP\n→\nDETALLE DINÁMICO\nLo que va encontrando\nVer estado\nEsta área todavía no tiene evidencia.\nEl asistente la completará cuando encuentre información verificable en el proyecto.",
      "chat": "HOY · SESIÓN ACTIVA\n✦\nOMP\nEste proyecto está vacío. Soy tu Arquitecto de Proyecto y te ayudaré a convertir una idea en un borrador PDAC. Cuéntame el primer caso de uso que quieres resolver; después te preguntaré por el actor, el resultado y las reglas importantes.",
      "suggestions": "Siguiente decisión\nDefinir primer caso de uso",
      "checks": {
        "centralSurfaceVisible": true,
        "diagramSurfaceVisible": true,
        "chatHasNoInternalPrompt": true,
        "statusIsSingleSource": true,
        "chatAndCenterAgreeOnProductSurface": true
      }
    },
    {
      "id": "F06-UX-G02-greenfield-after-omp",
      "screenshot": "docs/implementation/evidence/ux-scenarios/F06-UX-G02-greenfield-after-omp.png",
      "activeTab": "◇ProductShape×",
      "center": "ux-greenfield-biblioteca\n/\nProductShape\nOMP real · cwd activo\n◎\n0\n♙\n0\n◇\n1\n◈\n0\n↝\n0\n§\n1\n✓\n0\n◌\n0\nGUARDADO\nEmpezar\nMAPA PDAC · EVIDENCIA\nMapa editable de hallazgos\nLIVE\nLIENZO PDAC · OFFLINE\nArrastra, edita y añade detalles. Se guarda en este dispositivo.\n\nObjetivo actual: definir el caso de uso principal pa\n\nConfirmado\n\nUna persona puede reservar una plaza en un taller lo\n\nEl sistema debe enviarle una confirmación.\n\nIncógnitas\n\nQuién es exactamente esa persona: asistente, cliente\n\nQué inicia la reserva.\n\nQué información necesita aportar.\n\nMove focus to canvas\nPage 1\n76%\nActualizar mapa con OMP\n→\nDETALLE DINÁMICO\nLo que va encontrando\nVer estado\n01\nHECHO\nObjetivo actual: definir el caso de uso principal para un proyecto nuevo.\n¿Qué dispara la reserva: la persona encuentra un taller y pulsa “Reservar”, recibe una invitación, o existe otro punto de inicio?\n02\nHECHO\nConfirmado\n¿Qué dispara la reserva: la persona encuentra un taller y pulsa “Reservar”, recibe una invitación, o existe otro punto de inicio?\n03\nHECHO\nUna persona puede reservar una plaza en un taller local.\n¿Qué dispara la reserva: la persona encuentra un taller y pulsa “Reservar”, recibe una invitación, o existe otro punto de",
      "chat": "HOY · SESIÓN ACTIVA\n✦\nOMP\nEste proyecto está vacío. Soy tu Arquitecto de Proyecto y te ayudaré a convertir una idea en un borrador PDAC. Cuéntame el primer caso de uso que quieres resolver; después te preguntaré por el actor, el resultado y las reglas importantes.\nLC\nTÚ\nQuiero que una persona pueda reservar una plaza en un taller local y recibir confirmación.\n✦\nOMP\nObjetivo actual: definir el caso de uso principal para un proyecto nuevo.\n\nConfirmado\n• Una persona puede reservar una plaza en un taller local.\n• El sistema debe enviarle una confirmación.\n\nIncógnitas\n• Quién es exactamente esa persona: asistente, cliente registrado, vecino, etc.\n• Qué inicia la reserva.\n• Qué información necesita aportar.\n• Qué ocurre si no quedan plazas o la reserva no puede completarse.\n\nSiguiente pregunta:  \n¿Qué dispara la reserva: la persona encuentra un taller y pulsa “Reservar”, recibe una invitación, o existe otro punto de inicio?",
      "suggestions": "Siguiente foco PDAC\nRevisar propósito\nPreguntar por pendientes",
      "checks": {
        "centralSurfaceVisible": true,
        "diagramSurfaceVisible": true,
        "chatHasNoInternalPrompt": true,
        "statusIsSingleSource": true,
        "chatAndCenterAgreeOnProductSurface": true
      }
    }
  ],
  "repositoriesModified": false
}

Evaluación manual posterior: revisar cada PNG preguntando si el siguiente paso es obvio, si chat y centro nombran el mismo foco, si el diagrama muestra el último resultado y si no aparece ningún prompt interno.
