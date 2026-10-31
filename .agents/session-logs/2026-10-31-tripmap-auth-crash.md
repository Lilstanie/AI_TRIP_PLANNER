---
date: 2026-10-31
author: Claude
branch: fix/TP-207-tripmap-auth-crash
pr: none
area: apps/web
contract-impact: none
---

# A rejected Google key no longer stops the map from falling back

## What changed

- `MapRuntime.removeMarker` in `apps/web/components/map/map-renderer.ts` is the one way to detach a
  marker; `TripMap.tsx` and `map-layers.ts` use it.
- `google-renderer-fixture.mjs` now throws when a marker is detached from a rejected map and keeps
  errors from the failure handler, as the real SDK does.
- `trip-home-action-panels` checks the failure with markers on the map.

## Why

Google clears the map's container before it calls `gm_authFailure`, so `marker.map = null` threw. The
SDK swallows that error, which left `removeRenderer` unfinished: no `dispose`, no `setRuntime`, no
fallback. Markers were then drawn on the dead map until the page failed.

## Validation

Listed in the pull request body with their real results.

## Notes for the next person

The fixture only copies the SDK's behaviour; the real SDK check used a dev server, an expired key and
a saved Tokyo trip. `redgreen` needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set to a synthetic value, or
the journey never reaches the Google renderer.
