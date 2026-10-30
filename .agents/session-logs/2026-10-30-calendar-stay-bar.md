---
date: 2026-10-30
author: Claude Code
branch: feature/TP-182-calendar-stay-bar
pr: none
area: apps/web, docs
contract-impact: none
---

# Week calendar draws a stay as one bar

## What changed

- `lib/trip/calendar.ts`: `weekStays` joins consecutive week columns that hold the same all-day
  stay into one span with its column, length and total nights.
- `components/workspace/TripHomeCalendar.tsx`: Week view renders the spans in a lane under the
  dates and leaves stays out of each day's All day list; Month view is unchanged.
- `app/styles/trip-home-calendar.css`: the lane shares the week grid, so bars line up with the
  date columns and scroll with them in the narrow action panel.
- `tests/e2e/trip-home-calendar.e2e.mjs`, `calendar-stay-bars.failures.md`, `docs/workspace-ui*.md`.

## Why

A five-night hotel showed as five identical All day cards. Mindtrip's calendar draws a stay once,
across its nights.

## Validation

- `trip-home-calendar.e2e.mjs` against dev (mock data): before, the stay check failed with five
  repeated cards and no bar; after 44/44 (English desktop, western time zone, Chinese phone).
- `pnpm --filter @trip/web typecheck` and `lint`, `check-ui-copy`, `verify:docs`, translation pairs,
  `verify:e2e-selectors`, `verify:e2e-artifacts`, comment policy.

## Limitations

- Nights are counted by matching hotel name, so the same hotel booked twice in one trip with a gap
  shows the combined count.
