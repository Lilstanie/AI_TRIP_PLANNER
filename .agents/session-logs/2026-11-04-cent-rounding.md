---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/cent-rounding
pr: pending
area: packages/orchestrator, packages/agents
contract-impact: none
---

# Budget allocations and savings round whole cents correctly

## What changed

- `packages/orchestrator/src/planning/budget.ts`: `floorMoney` and `ceilMoney` round to cents after
  removing float noise, so an amount that is already whole cents stays unchanged.
- `planning/board.ts` (stage allocation), `planning/workflow.ts` (revision allocation) and
  `planning/conflicts.ts` (saving target) use them instead of `Math.floor/ceil(x * 100) / 100`.
- `packages/agents/src/dining/index.ts`: the meal rate's floor gets the same float-noise guard.
- `packages/orchestrator/tests/budget.test.ts`: rounding cases written before the helpers (red on
  `TypeError: floorMoney is not a function`), and the demo plan's dining total is AUD 220, not 219.84.

## Why

`Math.floor(1250.35 * 100) / 100` is 1250.34 and `Math.ceil(1.1 * 100) / 100` is 1.11. A section
re-planned at its last cost got a cap a cent below that cost, and the demo's AUD 220 dining
allocation became 219.99, so meals were priced at 13.74 instead of 13.75 a day.

## Validation

- `node -e` on the old expressions: 1250.34, 1.11, 0.08 for 1250.35, 1.1, 0.07.
- New rounding tests: 3 failed before the helpers, all pass after (every cent up to AUD 2000).
- `pnpm turbo run typecheck test`: 12/12 tasks; orchestrator 440, agents 213, web 683 tests passed.

## Notes for the next person

none
