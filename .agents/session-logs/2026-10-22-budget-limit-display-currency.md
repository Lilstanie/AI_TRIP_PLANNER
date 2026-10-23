---
date: 2026-10-22
author: Claude Code
branch: fix/budget-limit-display-currency
pr: none
area: apps/web, docs
contract-impact: none
---

# Budget over-limit message names the field's currency

## What changed

- `apps/web/lib/workspace/trip-facts.ts`: `factErrors()` takes the effective currency (default AUD)
  and states the AUD 1,000,000 cap converted with shared `fromAud`, rounded down to a whole unit
  (#522). The cap itself still applies to `budgetTotal` in AUD.
- `apps/web/components/preferences/TripFactChips.tsx`: passes the locale's currency.
- `apps/web/lib/i18n/workspace-messages.ts`: the message key takes `{amount}`.
- `apps/web/tests/e2e/budget-amount-limit.e2e.mjs`: a fresh USD workspace types 700000, expects a
  USD limit, then saves exactly the stated limit.
- `docs/workspace-ui.md` and its Chinese pair.

## Why

Rounding down keeps the stated number below the cap after `toAud`, so copying it always saves. The
USD case needs a fresh context: saving AUD earlier makes AUD the trip's display currency.

## Validation

- `DATA_MODE=mock pnpm --filter @trip/web e2e budget-amount-limit` with the source change stashed:
  exit 1, 6/8 ("Enter a total budget of AUD 1,000,000 or less."). With it: exit 0, 8/8
  ("… USD 666,666 or less.", and 666666 saves).
- Other checks are listed in the pull request's Evidence section.

## Notes for the next person

none
