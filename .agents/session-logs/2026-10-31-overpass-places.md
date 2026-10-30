---
date: 2026-10-31
author: Claude Code
branch: fix/TP-179-overpass-places
pr: none
area: packages/tools
contract-impact: none
---

# Find sights, neighbourhoods and restaurants on OSM by tag through Overpass

## What changed

- `packages/tools/src/overpass.ts` (new) and `maps-port.ts`: `osmPlaces` sends category queries
  without a text query to Overpass inside the city's OSM area; `runtime-context.ts` adds
  `OVERPASS_BASE_URL`.
- `packages/tools/tests/osm-places.test.ts`: failure modes first (name-match query, wrong area,
  no relation, city not found, Overpass error, text query and unmapped category unchanged).
- Agent Note `feature/2026-10-31-overpass-places.md`; `docs/architecture.md`, `docs/development.md`
  and their `.zh.md` pairs.

## Why

A real all-live trip on main got no day-by-day stops on `MAPS_PROVIDER=osm`: Nominatim returned 0
results for `sight in Tokyo` and foreign restaurants for `restaurant in Tokyo`. Joey chose Overpass.

## Validation

- `pnpm --filter @trip/tools exec vitest run tests/osm-places.test.ts` before the adapter: 4 failed,
  2 passed; after: 6/6. `pnpm --filter @trip/tools test` 150/150, `@trip/agents` 189/189,
  `pnpm typecheck` 6/6.

## Notes for the next person

This container cannot reach Overpass; the live check runs on Joey's Mac. `.env.example` (protected)
does not list `OVERPASS_BASE_URL` yet.
