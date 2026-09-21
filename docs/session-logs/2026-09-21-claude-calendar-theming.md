---
date: 2026-09-21
author: Claude Code (with A)
branch: fix/calendar-theme
pr: 28
area: apps/web
contract-impact: none
---

# Theme the calendar picker to match the app's dark UI

## What changed

- `apps/web/app/globals.css` — added `.rdp-day_button`, `.rdp-button_previous`
  and `.rdp-button_next` to the exclusion list of the global secondary-button
  rule, then added a `.date-picker` block mapping react-day-picker onto the
  app's own tokens.
- `apps/web/components/preferences/DateRangePicker.tsx` — wrapped `<DayPicker>`
  in a `.date-picker` div for that block to scope to.

## Why

The library being unthemed was only half the cause. This app's own rule
`button:not(.section__row):not(.stay-option):not(.primary):not(.trip__cta)`
has specificity (0,4,1) and was silently claiming every day cell, which is an
unclassed `<button>` — that is what produced the grey boxes. A
`.date-picker .rdp-day_button` override (0,2,0) loses to it, so the fix is to
opt out via that rule's own exclusion list, the way `.primary` already does,
rather than escalating specificity.

Reading computed styles back from the running page then exposed two more:
react-day-picker marks *every* day in a range `.rdp-selected`, middles
included, so a plain `.rdp-selected` fill flattened the range into one slab;
and the hover rule (0,4,0) outranked the selected rule (0,3,0), stripping the
accent background while `--on-accent` text stayed — near-black on grey. Hence
`:not(.rdp-range_middle)` on the fill and `:not(.rdp-selected)` on hover.

## Validation

- `pnpm test` 460/460; `pnpm typecheck`, `pnpm lint`, `pnpm build` clean
- Contrast measured in-page: 6.06:1 on range endpoints, 13.16:1 on the middle
  band, both above WCAG AA
- 375px: `.rdp-months` wraps, so the two months stack instead of overflowing

## Notes for the next person

Rebuilt on top of the PRs #25–#37 restructure, which moved this component into
`components/preferences/` and rewrote `globals.css`. The global button rule
survived that rewrite unchanged — if it is ever refactored, the calendar's
exclusions must move with it.
