---
date: 2026-10-29
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: workspace
contract-impact: none
---

# Fix Trip home Ideas, currency and suggestion recovery

## What changed

- Trip home cards, the Ideas drawer and Plan-aware suggestions now share one Ideas selector, so
  unscheduled restaurant suggestions agree with the displayed count.
- Bookings shows the established converted-currency estimate notice.
- Scheduling labels and the Flights heading now live in the translation catalogue.
- A null suggestion-dismissal record degrades to an empty record. A storage quota failure hides the
  suggestion for the current visit and reports that it could not be saved without an uncaught error.

## Validation

- Failure inventory updated before implementation in both focused E2E scripts.
- `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-ideas-bookings --prod` passed all 18 checks,
  including the corrected Ideas count, converted-price notice, English/Chinese paths and no browser
  errors. The initial red run failed the Ideas count and missing currency notice.
- `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-action-rail --prod` remained red before it
  reached the new suggestion-storage checks because switching to a newer Chat produced empty action
  content. T6 owns that latest-Plan/shared-editor defect; re-run the complete journey after its merge.
- `pnpm --filter @trip/web typecheck` passed.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs` reported no added helper-copy classes.

## Notes for the next person

- Re-run `trip-home-action-rail` after T6 integration to prove null-record and quota recovery.
- Calendar domain projection remains part of T8; the calendar component was not edited here.
- Evidence uses local fixtures only. No live provider, real model or physical-device claim is made.
