---
date: 2026-09-26
author: Claude Code
branch: feature/coordinated-planning
pr: none
area: packages/shared, packages/orchestrator, packages/agents, apps/web/tests, docs
contract-impact: packages/shared
---

# Specialists plan in stages over a shared board with AUD allocations

## What changed

- `packages/shared/src/agent.ts`, `contracts.ts`: optional `board`, `allocation`, `previous` on
  `SpecialistRequest`; `targetSaving` on `RevisionRequest`; `floorCost` on `AgentProposal`.
- `packages/orchestrator/src/board.ts` (new), `workflow.ts`, `supervisor.ts`, `conflicts.ts`:
  staged dispatch, allocations, AUD revision targets, infeasible-budget stop, best-so-far rounds.
- Transport, accommodation, itinerary and dining honour `allocation`; transport and accommodation
  report `floorCost`; itinerary reads the stay and flights from the board and its previous draft.
- `apps/web/tests/e2e/plan-quality.e2e.mjs`: `RUNS`, an infeasible expectation for Paris and a
  summary table; zero-cost sections are warnings.
- Tests rewritten for the new semantics in `packages/orchestrator/tests/budget.test.ts`,
  `workflow.test.ts` and `packages/agents/tests/transport/workflow.integration.test.ts`.

## Why

See the [Agent Note](../notes/implemented/architecture/2026-09-26-coordinated-specialist-planning.md).

## Validation

- `pnpm typecheck`: 6 tasks successful.
- `pnpm --filter @trip/orchestrator test`: 116 passed; `pnpm --filter @trip/agents test`: 117 passed.
- `RUNS=3 node apps/web/tests/e2e/plan-quality.e2e.mjs` (live): all 9 runs end in round 1; Tokyo and
  Bali within budget with no conflicts 6/6, Paris infeasible 3/3; median about 28 s.

## Notes for the next person

Activity costs are model estimates and often AUD 0 without priced evidence. Flights have no arrival
time, so day 1 cannot be planned after landing. Stacked on PR 73.
