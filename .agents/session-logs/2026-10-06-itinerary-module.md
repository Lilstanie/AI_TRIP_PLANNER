---
date: 2026-10-06
author: Claude Code
branch: refactor/itinerary
pr: none
area: apps/web, docs
contract-impact: none
---

# One Itinerary owns stops, ideas, stop numbers and visiting order (#197)

## What changed

- `apps/web/lib/trip/itinerary.ts` (new): `buildItinerary(plan, placeFor)` with `days()`,
  `stopsOn(day)`, `ideas()`, `stopCount`, `markersFor(day?)`, `stop(id)` and `planIndex(id, day,
  position)`; also `itineraryActivities` (moved from `lib/workspace`) and `visitingOrder`.
- `useTripPlaces` exposes `itinerary` instead of `markers`/`visits`/`activityForPlace`;
  `TripMapCanvas`, `TripPlaceList`, `TripEditor`/`TimelineStop`, `PhoneMapSheet`, `WorkspaceView`
  and the Trip badge read from it. `MapStop.order` is now `number`; `itinerary-route.ts` only draws.
- Tests: `tests/lib/trip/itinerary.test.ts` (failure cases first); the `itineraryOrder` test is gone.
- Docs: `docs/workspace-ui.md` and its Chinese pair; new
  [Agent Note](../notes/implemented/architecture/2026-10-06-one-itinerary.md); the 2026-09-24
  itinerary map note's line rule now points at it.

## Why

Spec #196 Q3–Q6: one stop number per place across the trip, visiting order everywhere, ideas never
counted. The preview endpoint stays as is; `planIndex` translates a shown position to its plan index.

## Validation

- `pnpm --filter @trip/web lint`, `typecheck`: clean. `test`: 46 files, 461 tests passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `check-pairs.mjs`: pass.
- Against `next start` with `USE_MOCK_TOOLS=true` (no Maps key): `phone-map.e2e.mjs` 0 failures at
  390 and 360 px; `itinerary.e2e.mjs` all checks ok at desktop and phone; `timeline.e2e.mjs` exit 0.
  No E2E assertion needed changing.

## Notes for the next person

- `planIndex` mirrors how `lib/trip/trip-edit.ts` reads a move's `index`; change both together.
- Live Google Maps rendering was not checked (no browser key in this environment).
