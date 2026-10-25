---
date: 2026-10-25
author: Claude Haiku 5.5 (scheduled triage task)
branch: fix/trajectory-empty-state
pr: none
area: apps/web
contract-impact: none
---

# Phone Trajectory tab empty state (#691)

## What changed
- `components/trajectory/TrajectoryTab.tsx`: with `phone` set, no assistant filter and no turns, render a `.trajectory-empty` card instead of the toolbar and ledger.
- `components/workspace/PhoneTrajectory.tsx` and `WorkspaceView.tsx`: pass `onPlanInChat` through to open the chat.
- `lib/i18n/phone-messages.ts`: Chinese copy for the card text.
- `app/styles/phone-shell.css`: card layout; the button is 44 px tall.
- `tests/e2e/trajectory-empty.e2e.mjs`: new E2E at 375 px, English and Chinese.
- `docs/workspace-ui.md` and `.zh.md`: describe the empty state and the new script.

## Why
The card follows the Trip tab's empty state. The toolbar is hidden because there is nothing to filter or search.

## Validation
- Before (unchanged code): `pnpm --filter @trip/web e2e trajectory-empty` failed with `waiting for locator('.trajectory-empty')` (timeout).
- After: the same command passed, 13 of 13 checks, both locales.
- `pnpm --filter @trip/web build`, `typecheck`, `test` (57 files, 642 tests), `lint` (one pre-existing `react-hooks/exhaustive-deps` warning in `PhoneTrajectory.tsx`, not from this change).
- `pnpm format:check-changed origin/main`, `verify:protected`, `verify:docs`, `verify:e2e-selectors`, `verify:e2e-artifacts` (150 scripts) all passed.

## Notes for the next person
- Desktop Trajectory tab (in the chat column) is unchanged; #691 is about the phone.
- With an assistant filter active and no turns, the filter bar still shows so the user can clear it.
