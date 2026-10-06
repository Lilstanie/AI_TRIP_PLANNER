---
date: 2026-10-06
author: Claude Code
branch: fix/184-phone-breakpoint-nav
pr: none
area: apps/web
contract-impact: none
---

# Keep phone navigation when Your trips crosses the phone breakpoint (#184)

## What changed

- `apps/web/components/workspace/useWorkspaceController.ts`: when `phone` is true and `page` is
  `trips`, switch to the workspace page with the Mine tab selected.
- `apps/web/tests/e2e/phone-mine.e2e.mjs`: opens Your trips at 800 px, resizes to 390 px, and checks
  the tab bar, Mine with trips listed, Settings and Chat without opening or creating a trip.
- `docs/workspace-ui.md` and `.zh.md`: describe the transition.

## Why

The phone shell has no Your trips page or menu button; Mine already lists the same trips and
calendar, so it is the phone equivalent rather than adding navigation to the trips branch.

## Validation

- `phone-mine.e2e.mjs` on mock dev server: 51/51; with the fix reverted the three new checks fail.
- `phone-shell.e2e.mjs` 252/252, `phone-state.e2e.mjs` 76/76.
- `pnpm --filter @trip/web typecheck` and `lint`: clean.

## Notes for the next person

Widening back past 520 px returns to the workspace page, not Your trips.
