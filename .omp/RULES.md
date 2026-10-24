# ProjectStudio constructor rules

- Execute exactly one approved phase. Current phase: Fase 00 only.
- Never start Electron/UI, Phase 01, or downstream product features in Fase 00.
- Never claim an OMP capability without a real process probe or a clearly labeled emulator.
- Keep OMP isolated by process, cwd, profile, project and thread identifiers.
- Treat host tools and permissions as host-owned; never expose arbitrary shell or paths.
- Record commands, exit codes, versions, blockers and evidence in STATUS.md.
- Stop at WAITING_USER_APPROVAL.
