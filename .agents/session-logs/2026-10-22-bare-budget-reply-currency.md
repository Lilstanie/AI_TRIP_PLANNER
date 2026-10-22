---
date: 2026-10-22
author: Claude Code
branch: fix/bare-budget-reply-currency
pr: none
area: packages/orchestrator, docs
contract-impact: none
---

# Coordinator says a bare budget number was taken as AUD

## What changed

- `packages/orchestrator/src/chat.ts`: one Money rule in the coordinator prompt. A bare budget
  number is recorded as AUD, so the reply says so and offers another currency, and never calls the
  currency unset or "left as you gave it" (#540).
- `packages/orchestrator/tests/bare-budget-currency.failures.md`: failure inventory, written first.
- `packages/orchestrator/tests/chat.test.ts`: the prompt carries the rule in both interface
  languages and keeps "leave budgetCurrency out when they gave a bare number".
- `docs/architecture.md` and its Chinese pair.

## Why

Joey chose (2026-10-22, in the project thread) to keep the display-currency rule and fix the reply
instead of showing an unconfirmed currency in the top bar.

## Validation

- `pnpm --filter @trip/orchestrator exec vitest run tests/chat.test.ts -t "bare budget"` before the
  prompt change: 1 failed. After: 1 passed.
- Other checks are listed in the pull request's Evidence section.

## Notes for the next person

Real model output is unverified here (no model keys); check one bare-budget turn on a live
deployment.
