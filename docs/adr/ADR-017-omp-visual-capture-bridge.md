# ADR-017: puente de capturas visuales OMP y fallback

- Estado: contrato de seguridad aceptado; implementación diferida
- Fecha: 2026-10-24

## Decisión

Las capturas/imágenes futuras se registrarán como artefactos con `artifactId`, MIME permitido, tamaño limitado, hash, `sourceRef` autorizado, proyecto/sesión y procedencia. El renderer sólo recibirá un ID autorizado; nunca una ruta `file://`, HTML o bytes inventados por el modelo.

Si una captura real no está disponible, el host conserva metadatos de bloqueo o un resultado de herramienta claramente marcado; no crea un placeholder que parezca captura real.

## Evidencia Fase 00

La skill `.omp/skills/studio-visual-artifacts/SKILL.md` y el dossier de evidencia dejan explícito que no hay UI en esta fase y no se fabrica screenshot.

## Pendiente

Validar `browser/computer/generate_image`, acceso a temporales y chunking real contra una versión OMP autenticada en Fase 05.
