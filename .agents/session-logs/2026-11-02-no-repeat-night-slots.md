---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-281-no-repeat-night-slots
pr: none
area: packages/agents, docs
contract-impact: none
---

# No repeated places across days; night places in the evening

## What changed

- `packages/agents/src/itinerary/fallback.ts` (new): the no-model fallback and its slots, moved out of `itinerary/index.ts` (was 999 lines). Night markets, bars, clubs, live music and shows get a 19:30 slot.
- `packages/agents/src/itinerary/index.ts`: `withoutRepeatedPlaces` drops a model stop that repeats an earlier day's place when that day keeps another stop and the city still has an unused candidate; the system prompt asks for night places at 18:00 or later.
- `packages/agents/src/itinerary/transfer-windows.ts`: `blockedAllDay` moved here so both files can use it.
- `packages/agents/tests/itinerary/index.test.ts`: two tests.
- `docs/architecture.md` + `.zh.md`: one bullet.

## Why

Live test 2026-11-02: Bangkok had Song Wat Street Art on days 4 and 5; New York had Union Square Night Market and Harlem Summer Nights at 13:00-16:00.

## Validation

- `pnpm --filter @trip/agents test` 211 passed (both new tests failed before the change), `pnpm --filter @trip/orchestrator test` 431 passed, agents typecheck and lint passed, file-length check passed.

## Notes for the next person

A repeat stays when it is the day's only stop or the city has no unused candidate; the fallback still cycles places when they run out.
