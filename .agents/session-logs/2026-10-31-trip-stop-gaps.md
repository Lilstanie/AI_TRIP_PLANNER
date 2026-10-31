---
date: 2026-10-31
author: Claude Code
branch: fix/TP-197-trip-stop-gaps
pr: none
area: packages/tools, packages/agents, apps/web
contract-impact: none
---

# Temples, neighbourhoods and driving estimates in the all-live Tokyo trip

## What changed

- `packages/tools/src/geoapify.ts`: Buddhist and Shinto places are separate requests of 200
  each. A failed request among the others logs its categories, and a partial answer is not cached.
  Neighbourhoods come from Geoapify `populated_place.*`, with Overpass as the fallback.
- `packages/agents/src/transport/validation.ts`: `routeProblem` takes `acceptDrivingEstimates`;
  `isDrivingEstimate` is exported.
- `packages/agents/src/itinerary/travel.ts` (split out of `index.ts`): hops between stops accept an
  OSRM driving estimate, still check it against the gap plus buffer, and count estimates so the plan
  says once that public transport was not checked.
- The landing rejection now asks the model to move the stop after landing instead of dropping it:
  the live rerun lost 浅草寺 after two drafts put it on the flight day.
- `apps/web/lib/map-provider/osm-places.ts`: explicit search for Han text uses Nominatim in any
  interface language.
- Agent Note `feature/2026-10-31-overpass-places.md`, `docs/architecture(.zh).md`,
  `docs/development(.zh).md` and the add-provider web map reference updated.

## Why

The live trip on e1b11de9 (2026-10-31) had no temple, because the combined temple request of 500
took 15–22 s and timed out silently. All three Overpass neighbourhood requests failed. Every hop was
an OSRM estimate reported as a conflict, so the plan was replaced by the fallback and asked the
traveller to fix it. In the English interface, `东京` was placed in Zhejiang.

## Validation

- Three failures inventories were written first, then the code.
- `han-text-search.test.ts` was red without the fix (1 of 3).
- Results after the fix: tools 173/173 (osm-places 29) and agents 206/206. The web tests are listed
  in the PR.

## Notes for the next person

The live rerun on 6a6fe065 (one run) had 5 shrines, Geoapify neighbourhoods, 0 conflicts and an
`estimated` source, but no Buddhist temple; the trip home map shows no pins when day 1 has none. `tourism.sights.place_of_worship` was dropped from the temple
request because `tourism.sights` already covers it.
