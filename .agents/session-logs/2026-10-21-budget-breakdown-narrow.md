---
date: 2026-10-21
author: Claude
branch: fix/budget-breakdown-narrow
pr: none
area: apps/web, docs
contract-impact: none
---

# Wrap budget breakdown rows in a narrow Trip drawer

## What changed

- `trip.css`: `.trip-panel__budget-breakdown` rows wrap, and their children may shrink, so the category amounts from #502 stay inside the drawer at the narrowest desktop split.
- Updated the English and Chinese UI documentation.

## Validation

- `pnpm -s e2e trip-drawer-narrow-split --prod` failed on main after #502 (four breakdown rows 9 px wider than the 181 px drawer); passes after.
- `pnpm -s e2e budget-category-breakdown --prod`: passes.

## Notes for the next person

- Fixture browser evidence only.
