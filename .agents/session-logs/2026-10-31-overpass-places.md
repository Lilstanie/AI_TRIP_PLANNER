---
date: 2026-10-31
author: Claude Code
branch: fix/TP-179-overpass-places
pr: none
area: packages/tools
contract-impact: none
---

# Free place search: Geoapify first, Overpass as the fallback

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
- Live run on Joey's Mac: public Overpass returned 502 or timed out for the whole hour, and a mirror
  answered a timeout as HTTP 200 with a `remark` runtime error. Added that failure mode (red, then
  green: 7/7, tools 151/151); a timeout is now a provider failure, not "no places".

- Joey then chose Geoapify with Overpass as the fallback. `geoapify.ts` plus six Geoapify failure
  modes written first (5 red, 1 already green), then 13/13; tools 157/157, typecheck and lint pass.

- Live run with the key: every Tokyo stop was on Iwo Jima (`filter=place:` covers the whole
  prefecture). Changed to a 15 km circle around the city centre with proximity bias; test red, then
  green 13/13.

- Next live run: stops in central Tokyo but all within 1 km of Tokyo Station, no temples; 京都
  geocoded to Jingdu (Shantou) 2 of 6 times. Now rank 500 named places by Wikipedia/Wikidata and take
  the most important of five geocode matches; tests red (3), then green 15/15, tools 159/159.

## Notes for the next person

This container cannot reach Overpass; the live check runs on Joey's Mac. `.env.example` (protected)
does not list `OVERPASS_BASE_URL` or `GEOAPIFY_API_KEY` yet.
