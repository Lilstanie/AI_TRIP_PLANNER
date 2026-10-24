---
date: 2026-10-24
author: Claude Opus 5.5 (project thread)
branch: fix/fixed-meal-rate
pr: none
area: packages/agents
contract-impact: none
---

# The planner sets a fixed meal rate

## What changed

- `packages/agents/src/dining/index.ts`: the dining specialist no longer asks the model for a daily
  per-person meal budget. `mealRate()` sets it in code: AUD 80 per person per day, capped by the dining
  share of the budget (or the budget allocation), with the budget-revision discount kept. The model
  only picks venues, and the fallback uses the same rate.
- Tests: dining unit tests and the orchestrator budget, dietary and weather-provider tests now expect
  the code rate.
- `packages/agents/tests/dining/meal-rate.failures.md`: failure inventory written before the change.
- `.agents/notes/implemented/feature/2026-10-24-fixed-meal-rate.md`: decision note.
- `docs/architecture.md` and `docs/architecture.zh.md`: one paragraph on who owns the meal amount.

## Why

Issue #639: the same trip cost AUD 920 for meals when the model answered (115 a day) and AUD 400 when
it fell back (50 a day). Joey chose a fixed code rate so the meal line no longer depends on whether
the model replied.

## Validation

- `pnpm --filter @trip/agents test`, `pnpm --filter @trip/orchestrator test`,
  `pnpm --filter @trip/web test`: all pass.
- `pnpm turbo run typecheck lint`: 12/12 tasks pass.
- Web E2Es in mock mode: budget-category-breakdown, planner-correctness, plan-quality,
  activities-not-costed, no-accommodation, display-currency, settle-path (results in the PR body).

## Docs and Agent Notes

`docs/architecture.md` (and the zh pair) and a new implemented Agent Note.

## Notes for the next person

The rate is AUD 80 per person per day. To change it, edit `DAILY_MEAL_RATE` and the note.
