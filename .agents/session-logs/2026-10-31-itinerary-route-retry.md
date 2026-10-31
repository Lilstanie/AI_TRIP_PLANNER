---
date: 2026-10-31
author: Claude Code
branch: fix/TP-211-itinerary-route-retry
pr: none
area: packages/agents
contract-impact: none
---

# The itinerary model redrafts once when stops leave too little route time

## What changed

- `packages/agents/src/itinerary/index.ts`: after a model draft passes validation, its route times are
  checked; when a leg does not fit, the second attempt gets those legs as feedback with the rejected
  draft, and the draft with fewer route conflicts is kept.
- `docs/architecture(.zh).md`.

## Why

In the live packed Tokyo run on main e5ba5796 the model drafted 6 sights a day with 10-20 minutes
between stops. Route conflicts were found only after drafting and never reached the model, so the
plan went to revision and the local fallback (at most 4 sights a day, fewer conflicts) replaced it.

## Validation

- `packages/agents` vitest 207 and `packages/orchestrator` vitest 422 passed; no new tests (Joey
  asked for as few as possible). Live check on the Mac follows the merge.

## Limitations

- Each model draft adds one round of route lookups.
