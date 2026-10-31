---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-222-rejected-google-map
pr: pending
area: apps/web/components/map
contract-impact: none
---

# Hide a rejected Google map instead of removing it (TP-222, TP-221)

## What changed

- `MapRuntime.dispose` hides the renderer child of a Google map whose key was rejected instead of
  removing it from the page; other maps are still removed.
- The trip flight card takes its stops from the leg it shows, so the return card shows the return
  leg's stops (the part of TP-221 that #867 did not cover).

## Why

Live Mac runs with the expired browser key gave a page error from Google's script in 4 of 6 trip
opens on main (1 of 6 before TP-217). Every run had the same order: markers created, key rejected,
markers removed, renderer child removed about 0.5 ms later, then a `getRootNode` or `setAttribute`
error from a promise queued by `new maps.Map` or an animation frame queued by
`AdvancedMarkerElement`, then the OSM map. Google still had work queued for a map we had taken out of
the page.

## Validation

- `apps/web`: `tsc --noEmit`, `next lint`, vitest for trip, workspace and map components (10 files,
  76 tests) pass.
- `pnpm --filter @trip/web e2e trip-home-action-panels` passes, including the Google key rejection
  checks.
- Live check with the expired key on the Mac follows.

## Docs

- `docs/map-renderer-lifecycle(.zh).md`, `docs/workspace-ui(.zh).md` flight card.
