---
date: 2026-10-31
author: Claude Code
branch: fix/TP-191-stop-menu-state
pr: none
area: apps/web, docs
contract-impact: none
---

# Stop menu shows the current visit progress and booking

## What changed

- `components/ui/ActionMenu.tsx`: an item can carry `checked` (and `radio`); it then renders as
  `menuitemradio` or `menuitemcheckbox` with `aria-checked` and a tick only when checked.
- `components/trip/timeline/TimelineStop.tsx`: Planned, Visited and Skipped are radio items with the
  current one ticked and enabled (choosing it again does nothing); Booked is a checkbox item; Remove
  moves to the end; Add again uses the plus icon instead of Edit details' pencil.
- `lib/i18n/workspace-messages.ts`: `Planned` and `Booked` replace the five unused "Mark as" strings.
- `app/styles/trip.css`: the menu item rules match every `menuitem*` role.
- `tests/e2e/stop-menu-state.e2e.mjs` and `.failures.md`, `docs/workspace-ui*.md`, the stop-menu
  Agent Note's item list.

## Why

Every status item carried the same tick, the current progress showed only as a greyed disabled item,
and Remove sat between Add again and Replace place, so a slip deleted the stop.

## Validation

- `stop-menu-state.e2e.mjs` against dev (mock data) at 1440 px and 390 px phone: before 9/25,
  after 25/25.
- Web `typecheck`, `lint`, `test`, `check-ui-copy`, `verify:docs`, translation pairs,
  `verify:e2e-selectors`, `verify:e2e-artifacts`, Prettier.

## Limitations

- None known.
