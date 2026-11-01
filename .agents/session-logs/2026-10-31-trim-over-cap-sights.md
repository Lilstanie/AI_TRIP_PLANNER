---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-216-trim-over-cap-sights
pr: pending
area: packages/agents/src/itinerary
contract-impact: none
---

# Drop sights over the pace cap after the model retries (TP-216)

## What changed

- After the itinerary model's retries, any day still holding more sights than the pace allows loses
  its latest-starting sights until it fits; meals stay. The trim is logged as `[itinerary]`.

## Why

The live packed Tokyo check on `main` 7926bf5 (after PR #863) kept the draft with the fewest problems,
which still had 7 sights on days 3, 4 and 5; the cap from TP-215 was only feedback to the model.

## Validation

- `vitest run`, `tsc --noEmit` and eslint in `packages/agents`.

## Limitations

- The model's own assumption text can still describe changes it did not make (for example "days 3-5
  reduced to 6" or "no activities on the return day").
