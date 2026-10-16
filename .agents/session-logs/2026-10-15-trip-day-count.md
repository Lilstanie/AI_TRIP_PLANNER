---
date: 2026-10-15
author: Claude Haiku 5.5
branch: fix/trip-day-count
pr: none
area: apps/web, packages/agents
contract-impact: none
---

# Trip day count is inclusive of both dates (#370)

## What changed

- `packages/agents/src/transport/validation.ts`: `planningDays` returns nights + 1.
- `packages/agents/src/dining/index.ts`: `tripDays` returns nights + 1.
- `apps/web/lib/trip/timeline.ts`: `dayCount` returns nights + 1.
- `apps/web/lib/trip/trip-edit.ts`: the day bound for edits is nights + 1.
- `apps/web/lib/planning/quick-prompts.ts`: example chip end dates now give the number of days in their label.
- Tests: fixture dates and expectations in agents itinerary and dining tests; the out-of-range edit test moved from day 4 to day 5.
- New E2E: `apps/web/tests/e2e/trip-day-count.e2e.mjs` (clicks the "Sydney · 4 days" chip).

## Why

Trip length was counted as nights in the planner and the timeline, but as inclusive days in the Dates chip.
Shared contract (`packages/shared`) keeps its nights rule for check-in/check-out, which is unchanged.

## Validation

- `pnpm --filter @trip/agents exec vitest run`: 125 passed.
- `pnpm --filter @trip/web test`: 631 passed.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`, `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`: pass.
- `DATA_MODE=mock ... pnpm --filter @trip/web e2e trip-day-count` (dev and `--prod`): FAILED. The chip was sent, but the agent reply did not appear within 240 s. The existing `itinerary` E2E fails the same way here, so the cause looks environmental. Not verified.

## Notes for the next person

- The day-count E2E has not passed in this environment. Check the agent reply path with server logs before trusting it.
- Same-day trips (check-in equals check-out) are still rejected by the planner, as before.
- #346 (5 vs 6 days) is covered by the same rule but not separately verified.
