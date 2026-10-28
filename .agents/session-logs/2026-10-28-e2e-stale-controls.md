---
date: 2026-10-28
author: Claude
branch: fix/e2e-stale-controls
pr: none
area: apps/web
contract-impact: none
---

# Fix nine E2E scripts that drove controls the workspace no longer has

## What changed

- `apps/web/tests/e2e/support/e2e-helpers.mjs`: `setDesktopLanguage` switches the language in Settings.
- `activities-not-costed`, `stop-progress`, `workspace-control-overflow`, `workspace-chinese`: switch
  language through Settings, close the Trip toggle by `aria-expanded`, return with the Conversation tab,
  and select a stop by clicking its row.
- `trip-display-currency`, `display-currency`, `budget-source-replacement`, `settings`, `trip-ui-triage`:
  go through the Trip home with `openTripWorkspace`, state the budget in the first message, read a blank
  trip's currency from the catalog, accept Chinese replies and the "unpriced costs" wording.
- `docs/e2e-known-failures.md` and `.zh.md`: the nine leave the failing list and get a covered entry.

## Why

Each script waited for a control that #740, the progressive-empty workspace or #765 moved or removed.
Product code is unchanged.

## Validation

Each script run alone as `DATA_MODE=mock pnpm --filter @trip/web e2e <name> --prod` passes.
`pnpm lint`, `verify:docs`, `verify:pairs`, `verify:e2e-selectors`, `verify:e2e-artifacts` and prettier pass.

## Notes for the next person

Ten scripts from the 2026-10-28 list still fail and are not investigated here: `reply-cost-line`,
`open-in-maps`, `workspace-performance`, `trajectory-timeline`, `cross-day-drag`,
`itinerary-walkthrough`, `trip-workspace-layout`, `calendar-trip-identity-search`, `stop-menu`,
`drag-in-day`.
