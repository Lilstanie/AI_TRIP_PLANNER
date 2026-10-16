---
date: 2026-10-16
author: Claude Haiku 5.5 (unattended triage run)
branch: fix/budget-amount-limit
pr: pending
area: apps/web
contract-impact: none
---

# Cap the budget sheet at AUD 1,000,000 (issue #373)

## What changed

- `apps/web/lib/workspace/trip-facts.ts`: `factErrors` rejects a budget above `MAX_TOTAL_BUDGET` (1,000,000) with `budgetTotal`.
- `apps/web/lib/i18n/workspace-messages.ts`: adds the English key and its Chinese string.
- `apps/web/tests/e2e/budget-amount-limit.e2e.mjs`: new E2E script, 6 checks.

## Why

The cap lives in the web layer. The budget schema in `packages/shared` is a protected shared contract, so it was not changed.

## Validation

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY= CLERK_SECRET_KEY= node tests/e2e/run.mjs budget-amount-limit`
  - Before the fix: the 20-digit checks FAIL (3 failures).
  - After the fix: 6/6 checks passed.
- `pnpm --filter @trip/web typecheck`: exit 0.
- `pnpm exec eslint` on the two changed lib files: no output.
- `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run` on `trip-facts.test.ts`, `TripFactChips.test.tsx` and `tests/lib/i18n`: 42 passed.
- `notice-keys` E2E: FAIL, on a live-mode `/api/chat` request that timed out in this sandbox. Not related to the budget change.

## Notes for the next person

- Clear the Clerk keys when running E2E locally. Otherwise the dev server redirects to `/sign-in`.
- The chip text uses a non-breaking space after `AUD`, so match with `\s`.
