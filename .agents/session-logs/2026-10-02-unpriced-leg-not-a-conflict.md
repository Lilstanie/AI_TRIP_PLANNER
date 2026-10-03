---
date: 2026-10-02
author: Claude Opus 5 (with A / @Lilstanie)
branch: fix/unpriced-leg-not-a-conflict
pr: none
area: packages/agents
contract-impact: none
---

# An unpriced transport leg no longer raises a conflict

## What changed

- `packages/agents/src/transport/index.ts`: `layOutHop` no longer pushes "Transport fare
  unavailable …"; the leg still carries no `estCost`.
- Same file, `assembleTransportProposal`: counts items with no `estCost` and states it in the
  summary (`· 2 leg(s) unpriced`) and as an assumption saying the known estimate is a floor.
- `packages/agents/tests/transport/index.test.ts`: the one test asserting the old conflict now
  asserts the new facts.
- Agent Note `2026-10-02-unpriced-leg-is-not-a-conflict`.

## Why

No revision can fix a fare the provider does not publish — Google returns no `transitFare` for
Australia at all — so the orchestrator spent a revision round on a request transport could only
answer the same way, and the plan still ended unresolved. #83 measured exactly this on Tokyo →
Kyoto and fixed the inter-city case by finding a real fare, while deliberately keeping itinerary
hops off the SerpApi quota. Those hops are therefore unpriced by design, and were conflicted
forever. A conflict is the UI's "needs_you" state; filling it with something the traveller cannot
act on buries the ones they can.

## Validation

`pnpm typecheck` clean, `pnpm test` 770/770, `pnpm lint`, `pnpm build`, `pnpm verify:docs`,
`pnpm verify:protected` clean. Not yet observed on a live plan.

## Notes for the next person

- The budget is now understated by exactly the unpriced legs. `floorCost` and the summary say so.
- This governs journey legs only; intra-city `arriveBy` connections never carried a cost.
- Next: a traveller-chosen mode per hop (`ModePreference` still has zero callers).
