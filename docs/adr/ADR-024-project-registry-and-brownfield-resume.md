# ADR-024 — Registro local de proyectos y reanudación brownfield

- **Estado:** aceptado para F05
- **Fecha:** 2026-10-24
- **Decisión:** ProjectStudio persiste referencias de proyectos fuera del repositorio analizado.

## Contexto

El workbench necesita listar proyectos, abrir uno nuevo, archivarlo y retomarlo. Archivar una referencia no debe borrar ni modificar el código, documentación, Git ni artefactos del proyecto. Al retomar, la UI debe reconstruir sus señales a partir del árbol real.

## Decisión

1. El registro vive en `.tmp/projectstudio-projects.json`, bajo control de ProjectStudio.
2. Cada entrada contiene `id` derivado de la ruta, nombre, ruta absoluta, `archived`, `lastOpenedAt` y señales `productShape` / `architecture`.
3. `＋` registra una carpeta local seleccionada por el usuario.
4. `⌫` realiza un soft-delete: marca `archived: true` y nunca llama a operaciones de borrado sobre la ruta.
5. Seleccionar una entrada archivada la reactiva, cambia el cwd del worker y vuelve a detectar:
   - `docs/product`, `productshape` o nombres raíz con `productshape`;
   - `docs/architecture`, `architecture`, `docs/adr` o nombres raíz con `architecture`.
6. LangGraph mantiene sus checkpoints en `.tmp/agent-runtime.sqlite`; no se mezcla con el registro ni con la base de datos del proyecto inspeccionado.
7. Si ProjectStudio se inicia con `PROJECTSTUDIO_PROJECT_ROOT`, esa ruta se incorpora y se activa en el primer arranque de la sesión.

## Consecuencias

- El usuario puede cambiar de cwd sin reiniciar la aplicación.
- Archivar es reversible y seguro para brownfield.
- El JSON es suficiente para el registro local y evita introducir otro binding SQLite nativo en Electron.
- La detección es una señal de reanudación, no una afirmación de que ProductShape haya validado el contenido. El workflow OMP sigue siendo el responsable de producir evidencia.
- La lista actual no sincroniza carpetas renombradas automáticamente; una ruta inexistente conserva la referencia para que el usuario la repare o archive.
