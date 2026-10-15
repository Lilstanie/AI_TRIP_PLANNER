---
date: 2026-10-15
author: Claude Haiku 5.5 (scheduled triage run)
branch: fix/where-sheet-empty-save
pr: none
area: apps/web
contract-impact: none
---

# Where sheet: Save with an empty destination keeps the sheet open

## What changed

- `apps/web/lib/workspace/trip-facts.ts`: `factErrors` no longer treats an all-blank Where draft as
  nothing to check, so an empty destination gets "Enter a destination." before a plan exists.
- `apps/web/tests/e2e/where-sheet-save.e2e.mjs`: new E2E. Empty Save keeps the sheet open with the field
  marked invalid; a filled destination then saves and closes it. Runs at 375×812 and 390×844.

## Why

Before a plan exists, `TripFactChips` saves whenever `factErrors` returns nothing. A blank Where draft
returned nothing, so the sheet closed and the trip kept no destination (issue #364).

## Validation

- `DATA_MODE=mock USE_MOCK_TOOLS=true MOCK_GOOGLE_MAPS= NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= pnpm --filter @trip/web e2e where-sheet-save`
  before the fix: 0 of 6 checks passed (the sheet closed on Save). After: 10 of 10 passed.
- `pnpm --filter @trip/web typecheck`: exit 0. `pnpm --filter @trip/web lint`: no warnings.
- `pnpm --filter @trip/web test`: 57 files, 631 tests passed.
- `prettier --check` on the changed files: pass.

## Notes for the next person

- Clearing the only destination on a planless trip now shows the error instead of saving an empty
  destination. Close the sheet to discard the edit.
- `trip-facts.ts` has an unused `brief` parameter in `apps/web/lib/workspace/trip-facts.ts` (pre-existing; not changed here).
