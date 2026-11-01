---
date: 2026-11-01
author: Claude Code for Joey
branch: fix/TP-229-map-repeat-place-routes
pr: none
area: apps/web, docs
contract-impact: none
---

# Keep every day's map route when a place is revisited (TP-229, #876)

## What changed

- `apps/web/lib/trip/itinerary.ts`: new `pathFor(day?)` keeps a place on every day it is visited; `markersFor` still gives one marker per place.
- `TripMapCanvas.tsx` passes `path`; `TripMap.tsx` draws the day lines from it instead of the de-duplicated markers.
- `tests/lib/trip/itinerary.test.ts`: one assertion on the existing revisit case. Docs: `workspace-ui.md` and `.zh.md` (Itinerary lines).

## Why

#876: a four-day Sydney trip showed lines for only two days. Lines were built from `markersFor()`, which drops a place after its first day, so later days lost that stop and a day left with one stop drew no line.

## Validation

- `pnpm --filter @trip/web typecheck` passed; `pnpm --filter @trip/web test`: 59 files, 638 tests passed.

## Notes for the next person

The reporter's exact plan was not available; the cause was found from code and the existing revisit fixture, not from their screenshot.
