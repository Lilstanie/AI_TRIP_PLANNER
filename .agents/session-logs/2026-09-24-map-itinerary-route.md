---
date: 2026-09-24
author: Claude Code (Opus 5.5, subagent)
branch: feature/map-itinerary-route
pr: none
area: apps/web, docs
contract-impact: none
---

# Location question on open, animated itinerary lines, labelled markers and drawer place list

## What changed

- Location: `useUserLocation` + `LocationPrompt` ask in-app on open; the browser prompt follows
  Allow location only; Not now is remembered (`trip.locationPrompt`).
- Map: `lib/map/itinerary-route.ts` (visiting order, per-day lines, flow loop),
  `components/map/map-layers.ts` (labelled markers, animated lines, label declutter),
  `google-maps-sdk.ts` (loader split out of `TripMap`), place popup with close/Escape/focus return.
- Drawer: `TripPlaceList` heads Overview; the overlay place list on the map is gone.
- Places field mask adds `primaryType` for the marker category icon.
- Docs: `docs/workspace-ui.md`, better-ui `glass.md`, new Agent Note
  [location prompt and itinerary map](../notes/implemented/feature/2026-09-24-location-prompt-and-itinerary-map.md).

## Why

Asking on load through `navigator.geolocation` breaks the request-on-action rule and browsers block
gesture-less prompts, so the question is ours and the browser prompt follows a press. The line
animation is Google's Symbol-offset technique; no reference site had a Google Maps polyline component.

## Validation

- `pnpm --filter @trip/web test`: 37 files, 350 tests passed.
- `(cd apps/web && npx tsc --noEmit)`: passed. `pnpm --filter @trip/web lint`: no warnings.
- `npx prettier --check` on changed files, `pnpm verify:docs`, `pnpm verify:protected`: passed.
- Browser (dev server, temporary `/debug/map` page with stubbed place search, deleted afterwards):
  1440×1000 and 390×844, light and dark. Checked the prompt (Allow, Not now persisted), labels,
  declutter, animated dashes (offset updates counted), reduced motion (no updates with the query
  stubbed), marker and label press, Enter on a focused marker, Escape focus return, drawer list
  selection, day muting, no horizontal scroll at 390.

- Parent session: on a saved Sydney plan in live mode, day 1 is joined 1→2→3→4 with flowing
  dashes, markers carry names, the Opera House card showed a real photo and rating, and the Trip
  drawer lists the places by day. Split into five commits, each checked with tsc, lint and tests.

## Notes for the next person

- The subagent could not study Mindtrip (Cloudflare check). After the owner cleared the check, the
  parent session saw that Mindtrip opens a full place pane (large photo, tabs) in place of the map
  column; this build keeps a card over the map, as the design contract requires.
- The preview browser reports geolocation as denied, so a real grant was not exercised.
- Pre-existing: at 390 px the partial-places status pill covers Show my location.
- No marker clustering yet; labels hide on overlap but every badge stays.
