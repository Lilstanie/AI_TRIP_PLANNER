---
date: 2026-10-06
author: Claude Code
branch: refactor/itinerary-timeline
pr: none
area: apps/web, docs
contract-impact: none
---

# Timeline moves pass the neighbour the traveller moved past (#202)

## What changed

- `apps/web/lib/trip/itinerary.ts`: `planIndex` clamps the position to the day; a stop moved later
  on its own day lands just after the stop shown above the target, any other move just before the
  stop shown at it, and the end of the day after every other stop in the plan.
- `apps/web/tests/lib/trip/itinerary.test.ts`: failure cases first, run through the real
  `previewEdit` (start times out of plan order, first and last stops, a repeat visit).
- Docs: `docs/workspace-ui.md` and its Chinese pair; the
  [one Itinerary note](../notes/implemented/architecture/2026-10-06-one-itinerary.md) now covers
  the timeline's move rule.

## Why

#197 already numbered and ordered the timeline from the Itinerary. But with start times out of plan
order, "Move later" sent the stop before the plan's next stop; the endpoint anchored it at that
stop's time and the stop stayed first. The endpoint re-times the day after the inserted stop, so
anchoring on the neighbour moved past keeps the requested swap without changing the endpoint.

## Validation

- `pnpm --filter @trip/web lint`, `typecheck`: clean. `test`: 48 files, 491 tests passed.
- New test was red before the fix ("moves a stop later ... disagree with plan order").
- `pnpm verify:docs`, `pnpm verify:protected`, `check-pairs.mjs --record docs/workspace-ui.md`.
- Against `next start` with `USE_MOCK_TOOLS=true` (no Maps key): `timeline.e2e.mjs` exit 0, route
  check skipped (place search 502); `itinerary.e2e.mjs` exit 0. No E2E assertion changed.

## Notes for the next person

- With start times out of plan order the endpoint can still re-time other stops of the day; only
  the swap with the neighbour is guaranteed. Moves in the browser were not exercised (no Maps key).
