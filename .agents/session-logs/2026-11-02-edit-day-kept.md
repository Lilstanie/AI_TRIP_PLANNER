---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-284-edit-day-kept
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# An edited day never ends empty

## What changed

- `packages/orchestrator/src/planning/edit-scope.ts`: `scopedItineraryEdit` keeps an edited day's previous stops when none of the new stops for that day survive the repeat filter.
- `packages/orchestrator/tests/edit-scope.test.ts` + `edit-scope.failures.md`: two tests.
- `docs/architecture-diagrams.md` + `.zh.md`: one clause.

## Why

Live rerun 2026-11-02 (Queenstown, "add a bungee jump on day 3"): the itinerary model fell back, the fallback's day-3 stops were all places already on days 1-2, the repeat filter from TP-275 dropped them, and day 3 came back empty.

## Validation

- `pnpm --filter @trip/orchestrator test` 434 passed (the first new test failed before the change), typecheck and lint passed.

## Notes for the next person

Why the Queenstown model draft fell back on that run is not visible in the stream; the other three scenarios used the model.
