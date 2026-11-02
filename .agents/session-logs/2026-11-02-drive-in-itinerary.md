---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-277-drive-in-itinerary
pr: none
area: packages/agents, docs
contract-impact: none
---

# Trips that drive in from home get a day plan again

## What changed

- `packages/agents/src/itinerary/index.ts`: `citiesForStayNights` accepts a transfer from `home` as the start of the day's city chain.
- `packages/agents/tests/itinerary/multi-city.test.ts`: one test, a Brisbane → Gold Coast drive with a drive home.
- `docs/architecture.md` + `.zh.md`: one clause.

## Why

Live test 2026-11-02: a family driving Brisbane → Gold Coast (27–29 Dec) got an empty itinerary with "day N transport does not end in the selected overnight city" on every day. Since #920 the first-day drive is a `home → Gold Coast` window, and `citiesForStayNights` only followed transfers leaving the current city, so it marked the chain broken and every later day empty.

## Validation

- `pnpm --filter @trip/agents test` 208 passed (new test failed before the fix), `@trip/orchestrator` 430 passed.
