---
date: 2026-10-24
author: Claude Opus 5.5 (project thread)
branch: fix/code-cost-sentence
pr: none
area: packages/orchestrator
contract-impact: none
---

# Code writes the reply's cost sentence

## What changed

- `packages/orchestrator/src/cost-line.ts`: `costLine()` builds the cost sentence from the plan in
  English or Chinese: total, categories with an amount, what is not included, exact headroom or
  overrun, and the minimum budget for an infeasible plan. `budgetText` and `wholeUp` moved here.
- `packages/orchestrator/src/chat.ts`: every reply that comes with a new plan ends with the cost
  sentence, for model and fallback replies alike. The fallback and @-mention replies use it too.
  `replan_trip` gives the model the plan without amounts, and the prompt tells it not to state
  totals, budget comparisons or what is included.
- `apps/web/tests/e2e/reply-cost-line.e2e.mjs`: replays the steps of #542, #475 and #476 plus a
  Chinese run, and compares the reply with the Trip budget card.
- `packages/orchestrator/tests/cost-line.failures.md`: failure inventory written first.
- `packages/orchestrator/tests/chat-plan-changes.test.ts`: three exact-reply expectations now end
  with the cost sentence.
- `docs/api.md`, `docs/api.zh.md` and an implemented Agent Note.

## Why

Issues #542, #475 and #476: the model's cost wording contradicted the budget card. Joey chose to
have code write the sentence.

## Validation

- `node scripts/redgreen.mjs reply-cost-line -- packages/orchestrator/src/chat.ts packages/orchestrator/src/cost-line.ts`:
  before (origin/main) exit 1, 19/31 ok; after exit 0, 40/40 ok.
- `pnpm turbo run typecheck lint test`: all pass after removing an unused import.

## Docs and Agent Notes

`docs/api.md` (and the zh pair) and `.agents/notes/implemented/feature/2026-10-24-code-cost-sentence.md`.

## Notes for the next person

The offline Chinese parser could not plan a typed Chinese request without a model, so the Chinese
E2E case uses the first example chip.
