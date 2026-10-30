---
date: 2026-10-31
author: Claude Code
branch: feature/stop-map-hover
pr: none
area: apps/web
contract-impact: none
---

# Itinerary stops and map markers highlight together on hover

## What changed

- `apps/web/lib/trip/stop-hover.ts`: one store for the hovered activity id.
- `TimelineStop.tsx` and `TripMap.tsx` write and read it; `map.css` and `timeline.css` style it.
- `MapStop` now carries `activityId`; the debug map and two map test fixtures supply it.
- `trip-home-map` E2E covers both directions.

## Why

A store outside React keeps a pointer move from rendering the whole workspace: only the row that
changes and the marker classes update. Touch input writes nothing, so no highlight sticks.

## Validation

- `pnpm --filter @trip/web e2e trip-home-map --prod`: passed, desktop, Chinese and phone runs.
- `pnpm --filter @trip/web exec vitest run tests/components/map`: 28 passed.
- `pnpm --filter @trip/web exec tsc --noEmit`, web lint, `check-ui-copy`, `verify:e2e-selectors`.

## Notes for the next person

A place visited twice has one marker, so its later stop highlights no marker.
