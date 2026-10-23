---
date: 2026-10-23
author: Claude Code
branch: fix/day-stops-sheet-state
pr: none
area: apps/web, docs
contract-impact: none
---

# Day stops handle names each sheet height

## What changed

- `apps/web/components/workspace/PhoneMapSheet.tsx`: the handle's `aria-label` names the current
  height ("Resize day stops, collapsed / half height / full height"); `aria-expanded` is unchanged
  (#607).
- `apps/web/lib/i18n/phone-messages.ts`: the three Chinese names replace the single one.
- `apps/web/tests/e2e/day-stops-sheet-state.e2e.mjs` and its failure inventory (written first).
- `docs/workspace-ui.md` and its Chinese pair.

## Why

`aria-expanded` has two values and the sheet has three heights, so half and full were
indistinguishable to a screen reader. Naming the height keeps the visible "Day stops" text inside the
name (#421) without a slider role the click-to-cycle handle does not behave like.

## Validation

- `node scripts/redgreen.mjs day-stops-sheet-state -- apps/web/components/workspace/PhoneMapSheet.tsx
  apps/web/lib/i18n/phone-messages.ts`: before exit 1, 51/53 ok; after exit 0, 53/53 ok (390 × 844,
  English and Chinese, every keyboard path and a click).
