---
date: 2026-11-01
author: Claude Code for Joey
branch: fix/TP-233-map-route-flicker
pr: none
area: apps/web, docs
contract-impact: none
---

# Draw every OSM route leg so day lines stop flickering (TP-233)

## What changed

- `apps/web/components/map/maplibre-renderer.ts`: `LibreLine` draws when the style itself has loaded
  (`map.style._loaded`) instead of `map.isStyleLoaded()`, and inserts each line below any route layer
  with a higher `zIndex`.
- `docs/workspace-ui.md` and `.zh.md`: new "OSM route layers" bullet.

## Why

Joey: route lines on the map flicker against each other. `isStyleLoaded()` is false while any source
is loading, including the GeoJSON source the previous leg just added, so every leg after the first was
skipped and only redrawn on a later `style.load`, which never came. A three-day Sydney fixture on main
drew only the first leg's white casing per day; which legs survived each redraw depended on timing.
MapLibre also ignored `zIndex`, so a later leg's casing covered an earlier leg's colour.

## Validation

- Local browser repro (3 days x 5 stops, mock data, OSM): before, one white leg per day; after, all
  legs in day colour on casing; Day 1/2/3 tabs switched three rounds gave identical screenshots per day.
- `pnpm --filter @trip/web typecheck`, `lint`, Prettier on changed files, `pnpm verify:docs` passed.

## Notes for the next person

PR #879 (TP-229) touches the same docs paragraph; the new bullet sits right after it.
