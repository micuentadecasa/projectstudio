# ProjectStudio — Constructor instructions (OMP)

## Mission
Build ProjectStudio per `docs/PRD.md` v3.0. Use can1357/oh-my-pi for all agent coding.
ProjectStudio itself embeds OMP, orchestrated by LangGraph.js.

## Non-negotiable architecture
- Electron/React UI; LangGraph.js durable workflows; OMP RPC adapter;
  typed CommandBus; Visual Artifact Bridge; SQLite + Git.
- OMP may produce screenshots/images; publish verified artefacts immediately.
- C4/PDaC remain semantic editable models with evidence; never bitmap-as-source.
- No arbitrary LLM-provided HTML, shell execution, paths or permissions.
- One main OMP agent; no subagents unless expressly approved.

## Working protocol
1. Read PRD + implementation/STATUS + relevant ADRs; inspect git state.
2. Work ONLY on the current approved phase and task IDs.
3. Implement, run real tests, collect real visual evidence; never fake passes.
4. Report files changed, test commands, evidence and outstanding issues.
5. Stop at `WAITING_USER_APPROVAL`. Never auto-advance.

## Git safety
No force push, destructive reset, deployments or editing external repos.
Keep commits small; never commit secrets. Worktree/diff/approval for managed repos.

## Definition of done
Typecheck, lint, tests, Playwright where relevant, manual checklist,
status update and user gate; regressions from previous phases remain green.
