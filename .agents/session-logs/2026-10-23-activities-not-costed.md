---
date: 2026-10-23
author: Claude Code
branch: fix/activities-not-costed
pr: none
area: apps/web, docs
contract-impact: none
---

# A fully unpriced budget category reads "Not costed"

## What changed

- `apps/web/components/trip/TripPanel.tsx`: a budget category whose items are all unpriced and
  whose amount is zero shows "Not costed" with its unpriced count, as Transport already did (#622).
  A category with any priced item keeps its amount.
- `apps/web/tests/e2e/activities-not-costed.e2e.mjs` and its failure inventory (written first).
- `docs/workspace-ui.md` and its Chinese pair.

## Why

"AUD 0.00 · Estimated" read as free activities when no stop had a price, and described the same
state as Transport in a different way.

## Validation

- `node scripts/redgreen.mjs activities-not-costed -- apps/web/components/trip/TripPanel.tsx`:
  before, exit 1 with 9/11 ok (Activities read "AUD 0.00 · Estimated · 4 unpriced" in English and
  Chinese); after, exit 0 with 11/11 ok.
- `budget-category-breakdown` passes (a category with one priced stop keeps its amount); web unit
  tests 642 passed.

## Known limitation

In mock mode with the Chinese interface, the first example chip gets a reply but no plan, so the E2E
plans in English and then switches language. Not investigated here.
