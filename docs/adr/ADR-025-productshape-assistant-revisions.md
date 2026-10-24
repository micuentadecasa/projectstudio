# ADR-025 — Asistente ProductShape con hallazgos y diagramas provisionales

- **Estado:** aceptado para el slice de descubrimiento brownfield
- **Fecha:** 2026-10-25

## Contexto

El usuario no debería ejecutar el CLI de ProductShape, leer todos sus documentos y construir manualmente un mapa mental. ProjectStudio debe acompañar el descubrimiento: explicar qué está revisando, publicar hallazgos comprensibles y mostrar un diagrama que evoluciona mientras el usuario conserva el control.

El resultado inicial no es todavía el ProductShape canónico ni una arquitectura aprobada. Es evidencia de trabajo que puede contener incógnitas y debe poder sustituirse sin sobrescribir un modelo aceptado.

## Decisión

1. El workflow `brownfield-discovery` sigue siendo el único que invoca OMP. El renderer no llama a OMP ni muestra prompts, frames RPC o razonamiento interno.
2. Cada bloque Mermaid reconocible durante el streaming o en la respuesta final publica/actualiza una revisión `provisional` en la superficie ProductShape. Las revisiones se conservan en memoria durante la sesión y el usuario puede volver a una revisión anterior.
3. Un artefacto previamente almacenado se muestra como `evidencia guardada`, separado de las revisiones provisionales nuevas.
4. El panel **Lo que va encontrando** deriva tarjetas breves del informe OMP y conserva rutas de evidencia cuando están presentes. No inventa hallazgos estáticos.
5. El estado visible distingue `trabajando`, `hallazgos preparados` y `listo`; la interfaz puede seguir usándose mientras OMP continúa.
6. La promoción de una revisión provisional a ProductShape/PDaC canónico queda fuera de este slice y requiere revisión humana posterior.

## Journey resultante

1. El usuario abre un repositorio con ProductShape o documentación equivalente.
2. ProjectStudio detecta el contexto y arranca el descubrimiento sin pedir un prompt técnico.
3. El asistente muestra el estado de la etapa y, al recibir resultado útil, añade hallazgos en **Lo que va encontrando**.
4. El canvas muestra el mapa provisional y conserva revisiones anteriores; el usuario puede seguir preguntando o inspeccionar la evidencia.
5. Sólo después de revisar hechos, inferencias e incógnitas se plantea documentar o promover un modelo canónico.

## Consecuencias

- El usuario recibe valor antes del resumen final y puede orientar la conversación con contexto.
- La sesión puede acumular hasta 12 revisiones temporales; no se escriben cambios en el repositorio del usuario.
- La extracción actual de hallazgos es deliberadamente conservadora y textual. La semántica canónica, backlinks y publicación VAB tipada quedan para el siguiente slice.
- El test visual reutiliza el informe real de Notes sin consumir tokens; el smoke `test:f04` comprueba además el recorrido con OMP real.
