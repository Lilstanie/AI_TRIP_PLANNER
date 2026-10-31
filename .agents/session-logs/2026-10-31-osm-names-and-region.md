---
date: 2026-10-31
author: Claude Code
branch: fix/TP-196-osm-names-and-city
pr: none
area: packages/tools, packages/agents
contract-impact: none
---

# Geoapify places keep their local name and stay in the visited region

## What changed

- `packages/tools/src/geoapify.ts`: names come from `name:<local language>` when the country has a
  mapping and the tag exists; one OSM object is listed once across both sight requests; places
  whose `iso3166_2` differs from the city centre's region are dropped.
- `packages/tools/src/overpass.ts`: `findCity` asks Nominatim for `addressdetails=1`.
- `packages/agents/src/itinerary/index.ts`: a failed place lookup now logs
  `[itinerary] Place provider unavailable for <category> in <city>: <reason>`.
- Agent Note `feature/2026-10-31-overpass-places.md` updated.

## Why

The live run on 2026-10-30 showed 浅草寺 as "Храм Сенсодзи 金龍山 浅草寺" in one of two versions
of the same way, and four Tokyo Disney rides (Urayasu, Chiba) among Tokyo's top 10 sights.
Neighbourhood lookups failed on Overpass with nothing in the server log.

## Validation

- `packages/tools/tests/geoapify-names-and-region.failures.md` written first; new tools tests red
  (2 of 4), agents warning test red, then tools 172/172, agents 202/202.

## Notes for the next person

The `iso3166_2` field on Geoapify places is assumed from the raw probe; the live run on the
developer's Mac confirms it. Stacked on TP-195 (#839).
