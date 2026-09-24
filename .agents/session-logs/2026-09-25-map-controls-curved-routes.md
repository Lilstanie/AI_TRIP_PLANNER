---
date: 2026-09-25
author: Claude Code (Opus 5.5)
branch: feature/apple-style-ui
pr: none
area: apps/web, docs
contract-impact: none
---

# Map controls, curved day-coloured routes, and the trip-open blur flash

## What changed

- Bug: opening a trip showed a blurred strip for the length of the view transition. The closed
  Chats panel carried `view-transition-name`, so it was captured with its glass. `motion.css` now
  names it only while `.is-open`.
- `TripMap.tsx`: View all places and Show my location left the top-left; a bottom-right glass
  stack (locate arrow, Satellite view, Zoom in/out) replaces them, Google's own UI is off, gestures
  are greedy. Route from my location moved into the place popup (`PlacePreview` `actions`).
  `MapViewController.viewAll` removed with its button.
- Routes: legs without a verified route are arcs (`curvedPath` in `lib/map/itinerary-route.ts`);
  each day has its own colour (`--day-1`…`--day-7`) on lines and stop badges, with a casing, a
  direction chevron per leg and flowing white dashes. Blue-dot user marker with a halo.
- `app/debug/map/page.tsx`: dev-only map with fixed Sydney stops (no Places or pricing calls).
- Docs: `docs/workspace-ui.md` map sections, the location/itinerary-map note, better-layout skill.

## Validation

- `tsc --noEmit`: pass. `pnpm --filter @trip/web test`: 37 files, 371 tests pass. Lint: clean.
- `CHANNEL=chrome node apps/web/tests/e2e/liquid-glass.e2e.mjs`: 28/28 checks pass, including the
  closed Chats panel having no transition name and the map control stack on `/debug/map`.
- Frame capture 30–260 ms into opening a trip: no blurred strip after the fix.
- `pnpm verify:docs`: pass.

## Notes for the next person

- Arcs are drawn only for unverified legs; verified Google Routes keep their real geometry.
- Satellite uses `hybrid` on the vector map ID; check it if the Map ID's styling changes.
