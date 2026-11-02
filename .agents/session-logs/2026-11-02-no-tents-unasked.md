---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-273-no-tents-unasked
pr: none
area: packages/agents, docs
contract-impact: none
---

# Stays skip glamping and campsites while anything else qualifies

## What changed

- `packages/agents/src/accommodation/planning.ts`: `eligibleOptions` drops stays named glamping, camping, campsite, campground, caravan, holiday park or tent unless they are all that is left.
- `docs/architecture.md` + `.zh.md`: one clause.

## Why

Live test 2026-11-02: a family of four in Singapore got two glamping bell tents for four nights (AUD 2,424). `STAY_TYPES` has no outdoor type, so nobody asks for one.

## Validation

- `pnpm --filter @trip/agents test` 207 passed, `@trip/orchestrator` 430 passed.

## Notes for the next person

Name match only; a provider type field would be sturdier if one appears.
