---
date: 2026-10-24
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/phone-map-empty-copy
pr: none
area: apps/web
contract-impact: none
---

# Phone Map empty hint names a visible control

## What changed

- `apps/web/components/map/TripMapCanvas.tsx`: the empty Map card uses "tap New trip at the top" when `phone` is set; desktop keeps "add them in the bar at the top".
- `apps/web/lib/i18n/locale.ts`: Chinese string for the new phone copy.
- `apps/web/tests/e2e/phone-map-empty-hint.e2e.mjs`: new E2E script covering 375, 520 and 1440 px in English and Chinese.

## Why

Issue #654: at phone widths the fact chips are hidden, so "the bar at the top" points at nothing visible. "New trip" is the visible title control on phone.

## Validation

- `pnpm --filter @trip/web build`: exit 0.
- `pnpm --filter @trip/web typecheck`: exit 0.
- `pnpm --filter @trip/web lint`: exit 0, no ESLint warnings or errors.
- `pnpm --filter @trip/web e2e phone-map-empty-hint`: exit 0, 12 checks ok (all widths, both languages, no page errors). Output under `apps/web/output/`.
- Not run: the pre-change state of the script (it was written against the fix), full web test suite.

## Notes for the next person

- Phone copy names "New trip", which is the visible title button. A dedicated "Add trip details" button in the card was not added.
