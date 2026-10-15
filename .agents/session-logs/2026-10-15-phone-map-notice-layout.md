---
date: 2026-10-15
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/phone-map-notice-layout
pr: none
area: apps/web
contract-impact: none
---

# Phone Map: the unplaceable-destination notice sits above the Day stops sheet

## What changed

- `apps/web/app/styles/phone-map.css`: on phone widths the empty map canvas aligns its content to the top
  with `padding-top: var(--space-5)`, so the "could not be shown on the map yet" notice sits above the
  default half-height Day stops sheet.
- `apps/web/tests/e2e/phone-map-notice.e2e.mjs`: new E2E. It plans the Sydney chip with the places search
  stubbed to empty, then checks the notice appears and its box ends above the sheet at 375×812 and 390×844.

## Why

The notice was centred in the full map panel, and the half-height sheet covers the lower half of that
panel, so the notice was clipped (issue #362). Top alignment keeps it in the visible area.

## Validation

- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= pnpm --filter @trip/web e2e phone-map-notice`
  before the CSS change: 4 of 8 checks passed (the two "sits above the sheet" checks failed at both widths).
  After: 8 of 8 passed.
- `pnpm --filter @trip/web test`: 57 files, 631 tests passed.
- `pnpm verify:e2e-selectors`, `pnpm verify:protected`: pass.
- `pnpm --filter @trip/web e2e phone-map` (same env): 3 checks fail at 390 wide (repeated place on the map).
  The same failures occur with the CSS change stashed, so they predate this change.

## Notes for the next person

- The notice check uses a planned Sydney trip; a longer destination name or Chinese copy may need a new
  look at the top offset.
- `phone-map` fails at 390 on `main` as well; it is not yet listed in `docs/e2e-known-failures.md`.
