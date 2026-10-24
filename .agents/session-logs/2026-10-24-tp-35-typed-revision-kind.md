---
date: 2026-10-24
author: Claude (Joey's thread, TP-35)
branch: fix/TP-35-typed-conflict-kind
pr: none
area: packages/shared, packages/orchestrator, packages/agents, apps/web (tests)
contract-impact: packages/shared
---

# Revision requests carry a typed kind (TP-35)

## What changed

- `packages/shared/src/contracts.ts`: `RevisionKind` and `RevisionRequest.kind`; `plan.ts` parses a missing kind as `request`.
- `packages/orchestrator/src/conflicts.ts`: sets the kind per conflict, promotes to the most severe kind per agent, and `isInfeasible` reads it.
- `packages/orchestrator/src/workflow.ts`: a traveller's @-mention revision is `request`.
- `packages/agents/src/accommodation/index.ts`, `dining/index.ts`: budget detection reads `kind`; the wording check is kept only for `request`.
- Test fixtures and `apps/web/tests/e2e/timeline.e2e.mjs` set a kind; new `packages/orchestrator/tests/conflicts.test.ts` covers budget, time and infeasible.

## Why

The decision and its alternatives are in
[the Agent Note](../notes/implemented/architecture/2026-10-24-typed-revision-kind.md).

## Validation

- Red first: the three new kind tests failed before the change.
- `packages/orchestrator` 314/314, `packages/agents` 148/148, `packages/shared` 58/58, `packages/tools` 141/141, `apps/web` `tests/lib` 387/387.
- `tsc --noEmit` clean in shared, tools, agents, orchestrator and web.

## Notes for the next person

- The fallback that parses a missing kind as `request` was not tested directly; it is covered by reading the schema only.
- The e2e timeline fixture was edited but not run here.
