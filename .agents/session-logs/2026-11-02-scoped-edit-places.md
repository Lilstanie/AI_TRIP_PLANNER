---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-275-scoped-edit-places
pr: none
area: packages/agents, packages/orchestrator, docs
contract-impact: none
---

# Named places survive the type filter and edited days skip kept places

## What changed

- `packages/agents/src/itinerary/interest-places.ts`: `namedPlaces` searches with category `attraction`, so `fitsCategory` no longer drops a named place whose Google types include an agency type.
- `packages/orchestrator/src/planning/edit-scope.ts`: `scopedItineraryEdit` drops an edited-day item whose location is already on a kept day.
- `docs/architecture-diagrams.md` + `.zh.md`: one clause each.

## Why

Live test 2026-11-02 (Queenstown): "add a bungee jump on day 3" added no bungee, and day 3 then held Lookout point and Arthurs Point, which days 2 and 4 already had.

## Validation

- `pnpm --filter @trip/agents test` 207 passed, `@trip/orchestrator` 430 passed, orchestrator typecheck passed.

## Notes for the next person

The dedupe matches the location text exactly (case-insensitive); two spellings of one place still repeat.
