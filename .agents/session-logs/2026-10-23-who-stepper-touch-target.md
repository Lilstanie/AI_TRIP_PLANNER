---
date: 2026-10-23
author: Claude Code
branch: fix/who-stepper-touch-target
pr: none
area: apps/web, docs
contract-impact: none
---

# Who sheet steppers are 44 px on phones

## What changed

- `apps/web/app/styles/trip-facts.css`: at phone widths the − and + stepper buttons in the Who sheet
  are 44 × 44 px instead of 40 × 40 px (#616). Desktop keeps 32 px.
- `apps/web/tests/e2e/who-stepper-touch-target.e2e.mjs` and its failure inventory (written first).
- `docs/workspace-ui.md` and its Chinese pair name the steppers among the 44 px sheet targets.

## Why

`docs/design/ui-guidelines.md` asks for 44 × 44 px hit areas inside phone sheets, and the steppers
are the most-tapped controls in a tight column.

## Validation

- `node scripts/redgreen.mjs who-stepper-touch-target -- apps/web/app/styles/trip-facts.css`:
  before, exit 1 with 30/42 ok (every button 40 × 40, taps 21 px from centre missed); after, exit 0
  with 42/42 ok at 360, 375 and 390 px in English and Chinese.
- `phone-sheet-targets`, `phone-touch-targets` and `party-breakdown-browser` pass.
