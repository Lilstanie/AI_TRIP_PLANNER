---
date: 2026-11-02
author: Claude Code (for Joey)
branch: feature/TP-256-agent-lab-live-default
pr: none
area: apps/web, packages/orchestrator, docs
contract-impact: none
---

# Agent Lab live runs are on by default and follow the Trip data preference

## What changed

- `apps/web/lib/agent-lab/live-gate.ts`: live is on unless `AGENT_LAB_LIVE_ENABLED=false`.
- `apps/web/app/agent-lab/page.tsx`: live availability per request via `liveDataBlock`; anonymous visitors see "(sign in)".
- `AgentLabClient.tsx`: starts in Live data when available and the saved Trip data preference is not sample data.
- `run.ts`: the run-started event names the data mode it ran with.
- Agent Note `2026-11-02-agent-lab-live-by-default.md`; en + zh docs updated.

## Why

The deployed site never set the opt-in, and only the repo owner can change its settings; sign-in already guards live.

## Validation

- Vitest `tests/lib/agent-lab`, `tests/app/api/agent-lab` (73 passed); orchestrator `tests/agent-lab` (106 passed).
- `pnpm --filter @trip/web typecheck` and lint, orchestrator typecheck: clean.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `check-ui-copy`: pass.

## Notes for the next person

A real live run needs the deployed site (local keys mostly dead); verify there after the merge.
