---
date: 2026-10-07
author: Claude Code (for Joey)
branch: docs/trip-display-currency
pr: none
area: docs
contract-impact: none
---

# Glossary: a trip's display currency is the last currency the traveller named

## What changed

- `GLOSSARY.md`: **Display currency** now says it belongs to a trip and is the last currency the
  traveller named for it (with a budget or on its own), otherwise the Settings currency.

## Why

Design discussion with Joey on 2026-10-07. Planning stays in AUD and Settings is never written by a
trip (existing Agent Notes). Joey decided that a currency named without a budget still sets the
trip's display currency, and that a later explicit request overrides the budget's currency while the
source budget keeps its original amount. The code does not do this yet: today the trip uses its
source budget currency, else Settings. Implementation follows in its own spec.

## Validation

- `pnpm verify:docs`: passed.
- `pnpm verify:protected`: passed.

## Notes for the next person

The implementation needs a new trip field in `packages/shared` and an Agent Note superseding the
currency choice in `2026-10-04-source-budget-entry.md`.
