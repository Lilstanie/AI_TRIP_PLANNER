---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-267-place-quality
pr: none
area: packages/tools, packages/agents, docs
contract-impact: none
---

# Sights follow interests and junk place names are filtered

## What changed

- `packages/tools/src/maps-port.ts`: Google sight/museum/neighbourhood queries use travel wording, ask for 20 results, and drop results by Google type (lodging, agencies, stores, offices, localities and regions; neighbourhoods must be an area or attraction).
- `packages/agents/src/itinerary/interest-places.ts` + `index.ts`: one extra search per interest and a family search when the party has children, interleaved ahead of generic sights; museums only first-class for museums/art and listed after sights.
- Fallback itinerary walks each city's candidates in order before repeating; the model prompt asks for each candidate at most once.
- `docs/architecture.md` and `.zh.md` describe the searches.

## Why

Prod live test 2026-11-02 (REPORT.md in project files): "sight in Singapore" returned "Sight Pte Ltd", Kyoto history+food got only museums, family trips had no kid sights, and 6 of 7 plans repeated stops.

## Validation

- `pnpm --filter @trip/tools test` 173 passed; `@trip/agents` 207 passed (one fallback expectation now picks the first unused Wollongong sight); `@trip/orchestrator` 430 passed.
- `pnpm typecheck`, `pnpm lint` pass.

## Notes for the next person

- Free-text wishes outside `TRIP_INTERESTS` (surfing, K-pop) still get no dedicated search; a follow-up `change_itinerary` with `places` covers them.
- Verified on prod after merge (no local Google key).
