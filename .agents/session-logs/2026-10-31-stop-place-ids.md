---
date: 2026-10-31
author: Claude Code
branch: fix/TP-183-stop-place-ids
pr: none
area: packages/shared, packages/tools, packages/agents
contract-impact: packages/shared
---

# Itinerary stops keep the OSM id the place tools found

## What changed

- `packages/shared/src/ports.ts`: optional `Place.placeId`.
- `packages/tools/src/overpass.ts` and `geoapify.ts`: set `placeId` as `osm:<type>/<id>`.
- `packages/agents/src/itinerary/index.ts`: activity items copy the matching place's `placeId`.
- Agent Note `bug-fix/2026-10-31-stop-place-ids.md`; failure inventory
  `packages/agents/tests/itinerary/stop-place-ids.failures.md`.

## Why

A live OSM trip on Joey's Mac planned six named stops and the map showed no pins: stops kept only
the name and the map's name search found none of them.

## Validation

- Failure modes written first; new tests red (tools 2, agents 2), then green.
- `pnpm --filter @trip/tools test` 159/159, `@trip/agents` 191/191, `@trip/orchestrator` 416/416,
  `@trip/shared` 58/58; `pnpm typecheck` and `pnpm lint` 6/6.

## Notes for the next person

Stacked on PR #823 (TP-179); rebase onto main once that merges. Live pin check runs on Joey's Mac.
