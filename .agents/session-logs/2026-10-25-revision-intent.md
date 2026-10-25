---
date: 2026-10-25
author: Codex
branch: fix/TP-88-revision-intent
pr: none
area: packages/agents, docs
contract-impact: none
---

# Keep specialist revision intent consistent

## What changed

- Added `packages/agents/src/revision-intent.ts`; transport, accommodation and dining use it.
- Added public-specialist integration cases and a failure inventory under `packages/agents/tests/`.
- Model requests carry normalized intent and share its authority rule; successful-path boundary cases cover it.
- Updated both architecture pages and the existing typed-revision Agent Note.

## Why

Typed conflicts must keep their behavior when their explanation changes. Ordinary traveller requests
retain the existing keyword fallback, including mixed saving and scheduling requests.

## Validation

- Focused integration run before implementation: 11 failed, 13 passed; after: 24 passed.
- Model-boundary transport/stay run before the model fix: 12 failed, 20 passed; after: 32 passed.
- `pnpm --filter @trip/agents test`: 16 files, 186 tests passed.
- `pnpm turbo run typecheck --filter=...@trip/agents`: agents, orchestrator and web passed.
- `pnpm --filter @trip/agents lint`: passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`: passed.
- Integration proposals are repeatable at `output/revision-intent/proposals.json`.

## Notes for the next person

GitHub [#701](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/701), Jira
[TP-88](https://headmastereggy.atlassian.net/browse/TP-88). Evidence uses fixed tools and disabled
models. The separate planning-readiness consolidation (#1 in the architecture review) remains open.
No shared contract or visible UI changed.
