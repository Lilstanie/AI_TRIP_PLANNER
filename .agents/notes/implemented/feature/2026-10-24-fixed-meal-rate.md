# Agent Note: The planner, not the model, sets the meal budget

Status: implemented

## Problem

The dining specialist's model returned its own `dailyBudgetPerPerson`, and the fallback used AUD 50.
The same "Sydney · 4 days" example therefore gave Meals AUD 920 when the model answered (AUD 115
per person per day) and AUD 400 when it timed out (#639). Model runs also varied between
themselves, so identical inputs gave different totals.

## Decision

`mealRate` in `packages/agents/src/dining/index.ts` sets the rate in code: AUD 80 per person per day,
lowered to what the budget leaves for meals (20 percent of the budget, or the budget pass's
`allocation`), cut by 30 percent on a budget revision, and rounded down to cents so the
meal-budget line's per person/day amount multiplies out to the total. The model receives that rate
as `dailyBudgetPerPerson` and only picks venues; its output no longer carries a rate. Joey chose this
on 2026-10-24.

## Alternatives considered

- Keep the model estimate and label fallback amounts as local estimates. Rejected: totals would still
  move between runs.

## Consequences

- The same brief gives the same Meals amount whether the model answers, fails or is absent.
- Plans saved earlier keep their stored meal amounts.
- Rounding the rate down can leave a few cents of an allocation unspent.
