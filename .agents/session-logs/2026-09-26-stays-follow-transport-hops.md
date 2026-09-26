---
date: 2026-09-26
author: Claude Code
branch: fix/stays-follow-transport-hops
pr: none
area: packages/agents, packages/orchestrator/tests, apps/web/tests, docs
contract-impact: none
---

# Multi-city stays change city on the day transport does

## What changed

- `packages/agents/src/transport/legs.ts`: `scheduledHops` reads inter-city hops from a transport
  proposal; the itinerary's `citiesByDay` now uses it.
- `packages/agents/src/accommodation/planning.ts`: `splitStay` takes the hops and gives each city
  the nights from its arrival day to the next hop, falling back to the even split.
- `packages/agents/src/accommodation/index.ts`: passes the transport proposal from the board.
- `packages/orchestrator/tests/budget.test.ts`: demo figures follow the new split (Tokyo 3 nights,
  Kyoto 4, matching the day-4 hop).
- `apps/web/tests/e2e/plan-quality.e2e.mjs`: checks later stays check in on their hop day.

## Why

Live "Tokyo & Kyoto": transport moved to Kyoto on day 3 and the day plan followed, but the stays
split nights evenly, keeping the Tokyo hotel until day 5.

## Validation

- `@trip/agents` 117 and `@trip/orchestrator` 116 tests pass; typecheck clean.
- `ONLY=tokyo-kyoto RUNS=2` (live): stays check in on the hop day in 2/2 (day 3).

## Notes for the next person

`tokyo-kyoto` still fails on the Tokyo → Kyoto drive with no fare (no Japanese transit data).
