---
date: 2026-11-01
author: Claude Code for Joey
branch: fix/TP-235-map-focus-stop
pr: none
area: apps/web, docs
contract-impact: none
---

# Centre the map on any chosen stop (TP-235)

## What changed

- `apps/web/components/map/TripMap.tsx`: choosing a stop always centres it and zooms in to at least
  `STOP_ZOOM` (14). Before, desktop panned only when the stop was off the map.
- `docs/workspace-ui.md` and `.zh.md`: place popup paragraph.

## Why

Joey: clicking any itinerary place in Trip should move the map to it.

## Validation

- Local browser run (3-day Sydney fixture, OSM): clicking Botanic Garden and The Rocks put the selected
  badge at the map centre (dx 0-1 px, dy 17 px badge offset) at zoom 14; switching to Day 2 still fit the
  whole day.
- `pnpm --filter @trip/web typecheck` passed.
