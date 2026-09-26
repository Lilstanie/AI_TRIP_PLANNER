---
date: 2026-09-26
author: Claude Code
branch: fix/dining-structured-output
pr: none
area: packages/agents, apps/web/tests
contract-impact: none
---

# Dining no longer falls back on over-long prose or an over-ceiling estimate

## What changed

- `packages/agents/src/clip.ts` (new): the sentence-end clipping the destination guide used, shared.
- `packages/agents/src/dining/index.ts`: the model schema has no length limits; `fitDiningDraft`
  clips prose, slices picks and caps the daily estimate at the ceiling with an assumption saying so.
- `packages/agents/src/destination-guide/index.ts`: uses the shared `clip`.
- `apps/web/tests/e2e/plan-quality.e2e.mjs`: checks dining is model-written.

## Why

Dining fell back in 9 of 12 live runs: the extraction failed on a length limit, and in one Paris
run the retries hit LangGraph's recursion limit of 25, taking 173 s. An estimate above the ceiling
also discarded every venue pick.

## Validation

- `pnpm --filter @trip/agents test`: 117 passed; typecheck clean.
- `RUNS=2 node apps/web/tests/e2e/plan-quality.e2e.mjs` (live): 6/6 pass; dining model-written 6/6;
  Paris 33 s.

## Notes for the next person

Stacked on PR 75. Transport `guidance` still has `.max(4)` on an array; no failure seen from it.
