---
date: 2026-09-26
author: Claude Code
branch: fix/itinerary-follows-transport-cities
pr: none
area: packages/agents, apps/web/tests, docs
contract-impact: none
---

# Multi-city day plans stay in the city transport put the traveller in

## What changed

- `packages/agents/src/itinerary/index.ts`: `citiesByDay` reads the inter-city hop from the
  transport proposal on the board (default split otherwise); the model gets `dayCities` and
  `candidatesByCity`; `validateDraft` rejects a stop outside that day's cities; the fallback uses the
  same split; the proposal records "Cities by day".
- `apps/web/tests/e2e/plan-quality.e2e.mjs`: `ONLY` filter, `tokyo-tight` and `tokyo-kyoto`
  scenarios, and a check that the day plan changes city on the day transport does.
- `docs/architecture.md`: the day-city rule.

## Why

Live "Tokyo & Kyoto": transport ran the hop on day 3 while the itinerary assumed day 4, and the
model draft sent the traveller back to Tokyo on day 4 after reaching Kyoto. Only the fallback used
a city split, and it ignored transport's choice.

## Validation

- `@trip/agents` 117 and `@trip/orchestrator` 116 tests pass; typecheck clean.
- `ONLY=tokyo-kyoto RUNS=2 node apps/web/tests/e2e/plan-quality.e2e.mjs` (live): the city check
  passes in 2/2 (days 1–2 Tokyo, day 3 hop, days 4–7 Kyoto); before, day 4 was in Tokyo.
- `ONLY=tokyo-tight RUNS=2` (live): 2/2 pass, round 1.

## Notes for the next person

`tokyo-kyoto` still fails "no unresolved conflicts": Google has no transit data in Japan, so the
hop is a 336-minute drive with no fare, a conflict no revision can fix. The return flight also
leaves from Tokyo while the trip ends in Kyoto, with no hop back.
