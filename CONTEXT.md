# ProjectStudio — contexto de dominio

## Propósito

ProjectStudio es un workbench local-first para documentar y diseñar sistemas con trazabilidad. El usuario expresa un objetivo; un workflow LangGraph coordina analizadores deterministas y, sólo cuando hace falta, solicita trabajo al único agente OMP activo. La UI publica artefactos y progreso, no el protocolo interno.

## Términos canónicos

- **Proyecto:** repositorio o conjunto de repositorios autorizados que comparten contexto, evidencias y sesiones.
- **Workflow:** grafo durable que resuelve una intención concreta y decide qué pasos deterministas o qué consulta OMP son necesarios.
- **Agente OMP:** único agente operativo invocado por un workflow; no es la UI ni el grafo. Puede investigar y proponer, pero el host controla permisos y publicación.
- **Evidencia:** referencia verificable a archivo, símbolo, configuración, test, log o recurso observado.
- **Hecho observado:** afirmación respaldada directamente por evidencia.
- **Inferencia:** interpretación razonable derivada de hechos; siempre marcada como tal.
- **Incógnita:** pregunta que la evidencia disponible no resuelve.
- **Baseline aceptado:** ProductShape/PDaC o arquitectura canónica vigente en el repositorio.
- **Propuesta:** revisión aislada en Architecture Lab; puede compararse y revisarse, pero no altera el baseline.
- **Artefacto:** documento, grafo, vista, diff, resultado de test o captura publicada por el host con procedencia.
- **Progreso:** actividad resumida para la persona (por ejemplo, «analizando dependencias»); nunca incluye prompts, argumentos de herramientas o checkpoints internos.

## Workflows de producto

1. **Brownfield discovery:** inventario → evidencias → hechos/inferencias/incógnitas → relaciones provisionales → revisión humana.
2. **Architecture documentation:** usa ProductShape aceptado y código observado para producir o actualizar una vista C4 con enlaces a evidencias.
3. **Architecture planning:** crea una propuesta separada para local, AWS o Azure; compara coste/riesgo/operación y preserva el baseline hasta una aprobación explícita.

## Invariantes

- Chat y canvas son superficies de presentación; no invocan OMP directamente.
- Todo trabajo que pueda gastar tokens o producir efectos pasa por un workflow LangGraph y un gateway OMP del host.
- El usuario ve progreso y resultados publicados; los prompts, RPC frames, argumentos de tools y checkpoints son internos.
- Un resultado tardío no puede publicarse en otro proyecto o hilo.
- Una propuesta nunca se confunde con arquitectura aceptada.
