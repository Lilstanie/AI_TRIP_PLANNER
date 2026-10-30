---
date: 2026-10-30
author: Claude Code
branch: fix/TP-188-plan-days-scroll
pr: none
area: apps/web, docs
contract-impact: none
---

# Reply day cards scroll with a mouse

## What changed

- `components/chat/PlanDays.tsx`: the strip sits in a `.plan-days-scroller` that tracks whether days
  are hidden on either side (scroll events and `ResizeObserver`) and shows an Earlier days or Later
  days arrow button there. A button scrolls by 80% of the strip width, smoothly unless reduced motion
  is set, and has `tabIndex={-1}`.
- `app/styles/messages.css`: the edge fade follows the hidden side; `scroll-padding-inline: 2px`
  matches the strip padding, so snapping no longer leaves the strip 2 px scrolled at the start;
  buttons are hidden on `hover: none` screens.
- `app/styles/forms.css`: `.plan-days__scroll` joins `.plan-day` in the generic button exclusions.
- `lib/i18n/workspace-messages.ts`: Chinese for the two button names.
- `tests/e2e/plan-days-scroll.e2e.mjs`, `plan-days-scroll.failures.md`, `docs/workspace-ui*.md`.

## Why

The strip hides its scrollbar and a vertical wheel does not move it, so with a mouse Day 4 and later
could not be reached, and the right edge stayed faded even at the end.

## Validation

- `plan-days-scroll.e2e.mjs` against dev (mock data), desktop, Chinese, reduced motion and 390 px
  phone: before 20/48, after 48/48.
- `reply-day-cards` E2E 15/15; `pnpm --filter @trip/web test` 635/635; web `typecheck`, `lint`,
  `check-ui-copy`, `verify:docs`, translation pairs, `verify:e2e-selectors`, `verify:e2e-artifacts`,
  Prettier.

## Limitations

- The trip panel's day strip keeps its thin visible scrollbar and has no arrow buttons.
