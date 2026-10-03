---
date: 2026-10-03
author: Claude
branch: fix/workspace-e2e-selectors
pr: none
area: apps/web
contract-impact: none
---

# Bring the settings and timeline E2E scripts up to date

## What changed

- `settings.e2e.mjs`: Settings opens from the sidebar's account menu (Open account menu, then a menu item), not
  from a button named Settings, which #93 removed. The phone path opens the drawer with Open navigation, takes the
  visible account menu button (the sidebar and the drawer each hold one), and hides the dev server's own badge,
  which sat over that button and took its clicks.
- `timeline.e2e.mjs`: without a map key the place search answers 502. That one console error is tolerated, any
  other failed request still counts, and the route check, which needs real place results, reports a skip instead of
  timing out.

## Why

Both scripts failed in a plain mock environment for reasons unrelated to the product: one selector from before
#93, and a dependency on a live map key that was never written down. No application code changed.

## Validation

- `settings.e2e.mjs`: 36 of 36 passed (desktop and phone) against `USE_MOCK_TOOLS=true` with every key blank.
- `timeline.e2e.mjs`: 24 passed, 0 failed, 1 skip (the route check). Run with a map key to cover the skipped part;
  that was not run here.
- `pnpm verify:docs` and `pnpm verify:protected`: see the pull request.

## Notes for the next person

- Prettier is not part of CI and these two files were already unformatted, so they were not reformatted.
- `itinerary.e2e.mjs` waits for a chat reply and was not run in this environment.
