---
date: 2026-10-22
author: Claude Code
branch: fix/day-plan-summary-matches-days
pr: none
area: packages/agents, docs
contract-impact: none
---

# Day plan summary describes the stops the itinerary keeps

## What changed

- `packages/agents/src/itinerary/index.ts`: a model-drafted itinerary's summary is the same
  `summaryCopy().itinerary` line the fallback uses, counted from the kept activities, instead of the
  model's own `summary` (#579). The fallback summary is unchanged.
- `packages/agents/tests/itinerary/model-summary.failures.md` (written first) and a test in
  `index.test.ts` with a model summary that calls the last day free.
- `docs/architecture.md` and its Chinese pair.

## Why

The live model wrote "the final day left free for departure" while its own draft, which validation
requires to cover every day, had a Day 4 stop. Free text cannot be checked against the stops, so it
is no longer passed on.

## Validation

- `pnpm --filter @trip/agents exec vitest run tests/itinerary/index.test.ts -t summarises` with the
  source stashed: 1 failed (received the model's summary). With it: `pnpm --filter @trip/agents test`
  144 passed; `pnpm --filter @trip/orchestrator test` 295 passed.

## Notes for the next person

The model schema still asks for `summary`; it is now unused for the proposal.
