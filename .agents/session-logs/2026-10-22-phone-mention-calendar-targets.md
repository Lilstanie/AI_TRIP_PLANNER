---
date: 2026-10-22
author: Claude Code
branch: fix/phone-mention-calendar-targets
pr: none
area: apps/web, docs
contract-impact: none
---

# Phone Mention chips and When calendar reach 44 px

## What changed

- `apps/web/app/styles/thinking.css`: the phone rule that sets Mention chips to 44 px now wins over
  the generic `button:not(...)` chain in `forms.css`, which held them at 38 px (#585).
- `apps/web/app/styles/trip-facts.css`: at 520 px and below the When calendar's day cells, day
  buttons and month arrows are 44 × 44 px, and Clear has a 44 × 44 px target (#588).
- `apps/web/tests/e2e/phone-sheet-targets.e2e.mjs` and its new `phone-sheet-targets.failures.md`.
- `docs/workspace-ui.md` and its Chinese pair.

## Why

The phone guideline asks for 44 × 44 px hit areas. The day circle grows to 44 px instead of keeping
a 34 px circle inside a larger hit area: seven 44 px columns fit the 356 px sheet, and a pseudo-element
hit area would have to reproduce the range-start, middle and end backgrounds.

## Validation

- `DATA_MODE=mock pnpm --filter @trip/web e2e phone-sheet-targets` before the CSS change: exit 1,
  three FAIL lines (chips 38 px; Clear 30 × 36, arrows 30 × 36, days 34 × 34 in both languages).
  After: exit 0, every check ok, no horizontal overflow.

## Notes for the next person

Desktop sizes are unchanged; only the 520 px block changed.
