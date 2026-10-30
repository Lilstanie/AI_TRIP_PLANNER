---
date: 2026-10-30
author: Claude Code
branch: fix/TP-187-trip-panel-head
pr: none
area: apps/web, docs
contract-impact: none
---

# Trip panel opens with the budget row

## What changed

- `components/trip/TripPanel.tsx`: removed the "destination · dates · travellers" line at the top of
  the panel and its now unused `traveller` and `travellers` Chinese strings.
- `app/styles/workspace-drawers.css`: the budget summary heads the panel with no top border, and its
  line keeps clear of the itinerary menu (48 px) and, in the Trip workspace, the open items badge
  (88 px).
- `app/styles/timeline.css`: the itinerary menu sits `var(--space-3)` from the top, on the budget row.
- `tests/e2e/trip-panel-head.e2e.mjs`, `trip-panel-head.failures.md`, `docs/workspace-ui*.md`.

## Why

The top bar chips (desktop) and the trip page chips (phone) already show destination, dates and
travellers, so the panel repeated them, and the badge and menu floated beside that repeated line.

## Validation

- `trip-panel-head.e2e.mjs` against dev (mock data) at 1440 px, 1000 px and 390 px: before 7/16,
  after 16/16.
- Web `typecheck`, `lint`, `check-ui-copy`, `verify:docs`, translation pairs,
  `verify:e2e-selectors`, `verify:e2e-artifacts`, Prettier, and the existing `one-line-budget`
  and `quiet-stop-rows` E2E.

## Limitations

- The phone Itinerary sheet now has no trip line of its own; it opens from the trip page that
  shows the chips.
