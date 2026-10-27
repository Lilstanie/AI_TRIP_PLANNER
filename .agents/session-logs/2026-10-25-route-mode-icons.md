---
date: 2026-10-25
author: Claude Opus 5 (with Ziqi He)
branch: feature/route-mode-icons
pr: none
area: apps/web, docs
contract-impact: none
---

# TP-97 Itinerary legs show how you travel them

## What changed

- `apps/web/lib/map/route-mode.ts` (new): the four `RouteMode` glyphs as path data, built into an
  SVG node the same way `categoryIcon` does, plus the existing message keys for their labels.
- `apps/web/lib/map/itinerary-route.ts`: `RouteLeg` carries the verified route's `mode`, so
  `dayRoutes` stops discarding everything but the polyline.
- `apps/web/components/map/map-layers.ts`: an active leg with a mode gets a round badge at the
  midpoint between its two stops, disposed with the rest of the layer.
- `apps/web/app/styles/map.css`, `TripMap.tsx`: badge styling, and the locale the badge title needs.

## Why

The map drew every leg the same, so a day of walking and a day of ferries looked identical. The mode
was already in `RouteResult`; nothing carried it to the renderer.

The badge is a marker, not a polyline `icons` symbol, because `LibreLine` in the MapLibre renderer
ignores `icons` entirely — the existing mid-leg chevron does not appear on OSM. Markers work on both.

It sits at the midpoint between the two stops rather than along the decoded path: the SDK type says
`decodePath` returns `Coordinate[]`, but Google really returns `LatLng` objects whose `lat` is a
method. Reading the path would need either a cast per renderer or a change to the shared SDK
adapter, neither worth the risk this close to the demonstration. On a winding leg the badge sits
near the line rather than exactly on it.

`zIndex` is 0 so place labels always win; at city zoom several legs are short and the badges would
otherwise cover stop names.

No new interface copy: `Walk`, `Public transport`, `Drive` and `Cycle` are already message keys used
by the timeline's leg picker, so the badge reuses them and needs no translation work.

## Validation

- `pnpm --filter @trip/web typecheck` clean; `pnpm --filter @trip/web test` 57 files, 642 tests.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs` — no added helper-copy classes.
- `pnpm verify:docs`, `pnpm verify:pairs` clean (28 pairs).
- Looked at it: `/debug/map` temporarily fed five legs covering all four modes, screenshotted at
  1100x820. The cycling badge sits centred on the Bondi-to-Coogee line, dark pill and white glyph,
  legible at its real 24 px. The temporary edit was reverted; the debug page passes `routes={[]}` as
  before.

## Notes for the next person

- This labels the four `RouteMode` values. Ferry, train and bus are not distinguishable: the Google
  field mask requests only `routes.duration`, `routes.polyline.encodedPolyline` and
  `routes.travelAdvisory.transitFare`, so no step-level vehicle type is ever fetched. Telling them
  apart means requesting `routes.legs.steps.transitDetails`, splitting a route into per-step
  segments, and adapting the OSRM and Transitous fallbacks to match.
- A mixed journey (walk, ferry, walk) is one polyline with one badge today. Splitting it is the same
  piece of work as the paragraph above.
