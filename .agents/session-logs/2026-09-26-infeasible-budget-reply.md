---
date: 2026-09-26
author: Claude Code
branch: fix/infeasible-budget-reply
pr: none
area: packages/orchestrator, apps/web/tests, docs
contract-impact: none
---

# The chat reply names the minimum budget when a plan cannot fit

## What changed

- `packages/orchestrator/src/chat.ts`: `planDigest` passes unresolved conflicts and their fixes to
  the reply model, with a reply rule for them; `fallbackReplyFor` states the minimum budget in plain
  words for an infeasible plan.
- `apps/web/tests/e2e/plan-quality.e2e.mjs`: the infeasible scenario checks the reply names a
  number within 5% of the minimum.
- `docs/architecture.md`: the reply digest.

## Why

In the browser (mock data, Tokyo & Kyoto for AUD 800) the reply said only that the plan "lands
well above your AUD 800 cap, so let's settle the budget first": the digest carried no conflicts,
so the AUD 2,810 minimum reached only the Review dialog.

## Validation

- Browser, phone width, mock data: the reply now says "about AUD 2,810 minimum for flights and 7
  nights for two, against your AUD 800".
- `pnpm --filter @trip/orchestrator test`: 116 passed; typecheck clean.
- `RUNS=1 node apps/web/tests/e2e/plan-quality.e2e.mjs` (live): 3/3 pass.

## Notes for the next person

Paris took 173 s in that run: the dining model hit LangGraph's recursion limit (25) with a zero
allocation, and a SerpApi hotel search timed out. Dining still uses strict `max()` lengths.
