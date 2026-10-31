---
date: 2026-10-31
author: Claude Code
branch: fix/TP-208-sight-quality
pr: none
area: packages/tools
contract-impact: none
---

# Sights skip numbered blocks and statues; OSM stops failing route options

## What changed

- `packages/tools/src/geoapify.ts`: sight and neighbourhood requests read up to three pages of 500
  (the next pages only when the first is full); results under `*.artwork` or `*.memorial` are
  dropped; a neighbourhood needs a Wikipedia or Wikidata tag (an OSM `neighbourhood` needs
  Wikipedia); a local name is kept only when the default name does not already extend it.
- `packages/tools/src/maps-port.ts`, `gateway-internal.ts`, `maps.ts`: the OSM port has no
  `routeOptions`, and the gateway exposes it only when the port has one.
- `docs/development(.zh).md`.

## Why

The live Tokyo plan listed 新富一丁目 and 八丁堀 as sights and 伊藤博文 (a statue) as a stop.
Geoapify returns results unordered and only the first page was read (200 of 1003 neighbourhoods,
500 of 1230 sights); 6 of 468 丁目 entries carry wiki tags. Every leg called `routeOptions`, which
always threw "Unsupported maps provider: osm", so progress showed "Tool unavailable" 66 times.

## Validation

- `packages/tools` tsc, eslint and vitest 173 passed. Updated the existing neighbourhood fixture
  and the provider-matrix OSM expectation; no new tests.

## Limitations

- A leg between stops is still the OSRM driving estimate.
