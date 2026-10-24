# ADR-020: aislamiento de AGENTS.md y skills

- Estado: aceptada para el constructor y contrato del producto
- Fecha: 2026-10-24

## Decisión

`AGENTS.md` raíz, `.omp/RULES.md` y `.omp/skills/` instruyen al OMP constructor de ProjectStudio. Los `AGENTS.md` de repositorios abiertos por el producto son datos no confiables y no conceden permisos. Las capacidades del OMP embebido se inyectarán por host y Permission Broker, no copiando estas reglas a repositorios ajenos.

El proceso OMP futuro tendrá cwd, perfil, sesión, proyecto y allowlist explícitos. Una allowlist de prompt no es aislamiento de OS.

## Evidencia Fase 00

Se crearon los archivos del constructor y se conserva aparte `AGENTS_ProjectStudio_OMP.md`, detectado como untracked en el estado inicial. No se borra ni se trata como instrucción canónica.
