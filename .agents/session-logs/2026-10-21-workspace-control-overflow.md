---
date: 2026-10-21
author: Codex
branch: fix/workspace-control-overflow
pr: none
area: apps/web, docs
contract-impact: none
---

# Keep narrow workspace controls inside their panels

## What changed

- `timeline.css` keeps place status beneath the place name and close button (#477).
- `workspace-drawers.css` wraps the budget status inside its available width (#478).
- `WorkspaceSidebar.tsx` scrolls an opened menu into view before focusing it (#486).
- Added a failure inventory and browser journey covering these controls and existing preference scrolling (#479).
- Updated the English and Chinese UI documentation.

## Validation

- Tested integrated revision `280fbd9991a634051cc2d18d94684c6c8d1a7d38`, including main's phone controls (#470).
- `LABEL=integrated-final pnpm --filter @trip/web e2e workspace-control-overflow`: exit 0, 191 assertions, 46 seconds; English and Chinese, 375–1440 px, both desktop split extremes, menu clicks and keyboard focus.
- Runner: `output/e2e/runner/2026-10-21T01-21-14-309Z.json`; screenshots and results: `output/playwright/workspace-control-overflow/integrated-final/`.
- Earlier red run reproduced the place grid, budget badge and bottom menu failures; harness setup and transition failures were retained before the final pass.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint`: passed.
- `pnpm verify:docs`, `pnpm verify:pairs` (27 pairs), `pnpm verify:protected`: passed.
- `pnpm verify:e2e-artifacts` (88 scripts), `pnpm verify:e2e-selectors`, `pnpm format:check-changed origin/main`: passed.

## Notes for the next person

- Fixture browser evidence proves layout and interaction; it does not exercise live providers, Clerk or a physical phone.
- #479 already scrolls correctly on current main; the regression journey verifies wheel and keyboard access at 1024 × 768 without changing preference production code.
- No shared contract or Agent Note change is required.
