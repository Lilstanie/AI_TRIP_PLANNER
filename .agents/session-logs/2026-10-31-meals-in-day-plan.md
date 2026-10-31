---
date: 2026-10-31
author: Claude Code
branch: fix/TP-195-meals-in-day-plan
pr: none
area: packages/agents, docs
contract-impact: none
---

# The day plan includes a meal at a restaurant the tools found

## What changed

- `packages/agents/src/itinerary/index.ts`: also reads `restaurant` places per city, using dining's
  dietary text query when the traveller has one. They are grounded for validation and passed to the
  model as `restaurantsByCity`.
- `packages/agents/src/itinerary/meals.ts` (new): the deterministic plan adds one lunch or dinner a
  day, rotating through restaurants and skipping slots that overlap stops, transfers or landing.
- `summary-copy.ts`: `mealStop` copy (en/zh); `dining/index.ts` exports `dietaryPreferencesForBrief`.
- Docs: `docs/architecture.md` (+ `.zh.md`).

## Why

A live Tokyo trip on 2026-10-30 had restaurants in the dining section, but the day plan said it had
no dining candidates, because the itinerary only asked for sights and neighbourhoods. Dining runs in
parallel with the itinerary, so the itinerary cannot wait for dining's picks; it reads the same
category, which Geoapify's 10-minute cache answers once.

## Validation

- `meals-in-day-plan.failures.md` written first; 4/4 new tests failed, then passed.
- `pnpm test` (all packages) passes: agents 201/201, orchestrator 417/417, web 58 files.
- `index.test.ts` now expects 6 place queries for two cities (restaurants added).

## Notes for the next person

Stacked on TP-194 (#837).
