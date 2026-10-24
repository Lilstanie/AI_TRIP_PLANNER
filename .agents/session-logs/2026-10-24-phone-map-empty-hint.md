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
- `pnpm --filter @trip/web e2e phone-map-empty-hint`, fixed code: exit 0, 16 checks ok (all widths, both languages, no page errors, New trip control visible on phone).
- Same script with `TripMapCanvas.tsx` and `locale.ts` restored to `origin/main` (b12fcbf0): exit 1. The four phone copy checks failed, the desktop checks passed.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs`: exit 0, "No added helper-copy classes."
- `pnpm verify:docs` and `pnpm verify:protected`: exit 0.
- Not run: full web test suite.

## Docs and Agent Notes

No `docs/` page or Agent Note needs an update. The change is copy only and the behaviour is covered by the new E2E.

## Notes for the next person

- Phone copy names "New trip", which is the visible title button. A dedicated "Add trip details" button in the card was not added.
- The phone E2E uses 375 and 520 px. The issue's reproduction used 390 px, which is inside the same `max-width: 520px` branch.
