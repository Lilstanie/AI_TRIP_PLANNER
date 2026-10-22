---
date: 2026-10-21
author: Claude
branch: fix/phone-stop-menu
pr: none
area: apps/web, docs
contract-impact: none
---

# Keep the phone stop menu on screen

## What changed

- `ActionMenu.tsx` caps an open menu to its scrolling panel's height, scrolls it into view and keeps the focused item visible (#509).
- `trip.css` lets `.action-menu__list` scroll inside itself.
- Added `phone-stop-menu` browser journey at 390 × 844 and 360 × 640.
- Updated the English and Chinese UI documentation.

## Validation

- `pnpm -s e2e phone-stop-menu --prod`: failed before the fix (items under the tab bar), 8/8 checks pass after.
- `workspace-control-overflow` and `timeline` journeys pass.
- `drawer-walkthrough`, `itinerary`, `notice-keys` and `trip-ui-triage` fail identically on main with the change stashed.

## Notes for the next person

- Fixture browser evidence only; not checked on a physical phone.
