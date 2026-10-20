---
date: 2026-10-20
author: Codex
branch: fix/calendar-trip-date-label
pr: none
area: apps/web, docs
contract-impact: none
---

# Localize calendar trip date ranges

## What changed

- `TripsPage.tsx` shares its UTC full-date formatter between date cells and trip bands.
- Calendar bands announce both inclusive endpoints in the current UI language.
- Added a browser journey and a failure inventory before production edits; synchronized workspace UI docs.

## Validation

- `RUN_ID=before-final CHANNEL=chrome pnpm --filter @trip/web e2e calendar-trip-date-label`: exit 1, 88/107 passed; 19 expected raw-date and language-switch failures.
- `RUN_ID=after-final CHANNEL=chrome pnpm --filter @trip/web e2e calendar-trip-date-label`: exit 0, 107/107 passed, no skips.
- Chrome 155.0.8059.85; English/Chinese; 1440, 390 and 375 px; Honolulu/Sydney time zones; local mock catalog.
- Before/after `output/playwright/calendar-trip-date-label/` contains JSON, ARIA, HTML and screenshots. Runner reports: `2026-10-20T11-53-18-137Z.json` and `2026-10-20T11-54-17-280Z.json`.
- Existing web tests: 642/642 across 57 files; web typecheck and lint: exit 0.
- Docs, translation pairs (27), protected files, artifact, selector and scoped added-comment checks: exit 0.

## Notes for the next person

- Earlier fixture runs stopped on asynchronous focus or invalid settings fixtures; corrected before the equivalent baseline. They are not passing acceptance evidence.
- Same-day and invalid-date catalogs retain existing rejection behavior. No live provider, real authentication, physical device or screen-reader speech acceptance is claimed.
- Shared contracts and Agent Notes need no changes; both workspace UI documents were updated.
