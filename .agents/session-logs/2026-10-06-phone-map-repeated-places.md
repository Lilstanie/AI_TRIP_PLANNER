---
date: 2026-10-06
author: Claude Code
branch: fix/185-phone-map-repeated-places
pr: none
area: apps/web, docs
contract-impact: none
---

# Phone map keeps a repeated place on every day it is visited (#185)

## What changed

- `apps/web/components/map/useTripPlaces.ts`: new `visits` (every located activity, repeat visits
  carry their place's marker number); `markers` is now `firstVisits(visits)`; `activityForPlace`
  takes an optional day.
- `apps/web/components/map/TripMapCanvas.tsx`: a focused day's stops come from that day's visits
  (deduplicated within the day); selection resolves through `visits` and map presses through the
  focused day.
- `apps/web/components/workspace/PhoneMapSheet.tsx`: stop numbers come from `visits`, so the
  repeat stop is numbered and collapses the sheet when chosen.
- `apps/web/tests/e2e/phone-map.e2e.mjs`: fixture makes day 2's first item revisit day 1's place;
  checks both days' maps, map press → day 2 stop, and day 2 details.
- `docs/workspace-ui.md` and `.zh.md`: phone map day filtering of repeated places.

## Why

The trip-wide marker list deduplicated by place and kept day 1, so the day 2 filter dropped the
place and the day 2 activity ID resolved to no marker. The desktop (whole-trip) map keeps one
marker per place.

## Validation

- `BASE_URL=http://localhost:3102 node apps/web/tests/e2e/phone-map.e2e.mjs` (mock dev server):
  before the fix 3 new checks failed and the run aborted; after it 54/54 passed.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`: pass.
- `vitest run tests/components/{map,trip,workspace}`: 89/89 pass.

## Notes for the next person

- Centring is not observable without a Maps key; the E2E checks the day 2 stop resolves (details
  show "Day 2"), which is the stop the pan effect uses.
- The desktop timeline (`TripPlaceList`) still numbers only first visits.
