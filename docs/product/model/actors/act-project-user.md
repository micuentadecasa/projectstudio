# Actor — persona usuaria del proyecto

## Identidad

Persona responsable de producto, arquitectura o desarrollo que necesita entender un repositorio existente y decidir el siguiente paso con el equipo.

No se distinguen todavía permisos por rol dentro de la aplicación: el producto actual trabaja con un usuario local y referencias de proyectos locales.

## Objetivos

- identificar el proyecto activo y sus señales documentales;
- revisar hechos antes de aceptar inferencias;
- seguir el descubrimiento sin exponer detalles internos del agente;
- volver a un proyecto archivado sin perder el repositorio;
- decidir si hace falta profundizar en ProductShape o documentar arquitectura.

## Responsabilidades fuera del sistema

- validar que una inferencia representa el sistema real;
- decidir qué baseline queda aceptado;
- autorizar cualquier cambio futuro con efectos sobre código o infraestructura.

## Evidencia

- `docs/implementation/JOURNEY-BROWNFIELD.md:3-15` define el usuario y el resultado esperado.
- `docs/implementation/JOURNEY-BROWNFIELD.md:19-28` define las acciones visibles.
- `apps/desktop/src/renderer/main.tsx:791-803` expone objetivos y composer.
