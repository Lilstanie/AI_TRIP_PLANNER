---
date: 2026-09-26
author: Claude Code
branch: feature/japan-rail-via-serpapi
pr: none
area: packages/shared, packages/tools, packages/agents, docs
contract-impact: packages/shared
---

# Price inter-city rail where Google Routes has no transit

## What changed

- `packages/shared/src/ports.ts`: optional `intercity` and `passengers` on `RouteQuery`.
- `packages/tools/src/serpapi.ts`: `searchTransitSerpApi` (`google_maps_directions`, transit) on
  the shared quota and cache.
- `packages/tools/src/maps.ts`: `route()` tries it for an `intercity` hop whose Google transit is
  empty or slow, converting the per-person fare to AUD for the group; otherwise drives as before.
- `packages/agents/src/transport/index.ts`: ground hops set `intercity` and `passengers`.
- Agent Note `.agents/notes/implemented/feature/2026-09-26-intercity-rail-via-serpapi.md`; docs
  provider table and workspace-ui.

## Why

Tokyo → Kyoto became a 336-minute drive with no fare, a conflict no revision could fix. One
approved SerpApi query returned the Tokaido Shinkansen, 2 h 10 min, JPY 14,170 per person.

## Validation

- `pnpm typecheck`; `@trip/tools` 113 and `@trip/agents` 117 tests pass.
- `ONLY=tokyo-kyoto RUNS=1` (live): 1/1 pass, 2 rounds; day 3 Tokyo → Kyoto is a train, 176 min,
  AUD 286.60 for 2. Before: 0/2, drive with no fare, 3 rounds, unresolved conflict.

## Notes for the next person

City names geocode to city centres, so the leg includes local rail to the Shinkansen (176 vs
130 min station to station). Each uncached hop costs one SerpApi search.
