---
date: 2026-10-16
author: Claude Opus 5.5
branch: fix/calendar-bar-contrast
pr: pending
area: apps/web
contract-impact: none
---

# Fill the calendar trip bar with its palette's dark stop (issue #357)

## What changed

- `apps/web/components/workspace/TripsPage.tsx`: the calendar bar background is the first (dark) stop of its cover palette instead of the gradient midpoint.
- `apps/web/tests/e2e/calendar-bar-contrast.e2e.mjs`: new E2E; computes white-text contrast for all eight palettes and measures the rendered bar in light and dark mode.
- `apps/web/tests/e2e/support/e2e-helpers.mjs`: adds `EXAMPLE_CHIP_SELECTOR`.
- `docs/workspace-ui.md` and `.zh.md`: the calendar paragraph names the bar fill.

## Why

Decided with the owner: change only the calendar bar, leave trip covers as they are. The midpoint failed 4.5:1 for three of eight palettes; every dark stop passes (7.81 to 12.46:1).

## Validation

- `node tests/e2e/run.mjs calendar-bar-contrast` without the fix: light bar 4.32:1 FAIL; the dark pass timed out waiting for the mock planner reply.
- Same command with the fix: 13/13 checks passed, rendered bar 10.16:1 in light and dark.
- `pnpm --filter @trip/web typecheck` and `lint`: exit 0. `vitest run tests/components/workspace`: 45 passed.
- `pnpm verify:e2e-artifacts`, `verify:e2e-selectors`, `verify:pairs`, `verify:docs`: pass.

## Notes for the next person

- The E2E waits up to 240 s for the mock planner reply; one before-fix pass hit that limit.
