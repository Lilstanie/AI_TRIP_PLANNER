---
date: 2026-10-31
author: Claude Code
branch: fix/TP-178-export-bookings
pr: none
area: apps/web
contract-impact: none
---

# Put flights and the hotel into Copy trip and Download calendar

## What changed

- `apps/web/lib/trip/export.ts`: `bookings()` reads the selected flight candidate (outbound and
  inbound legs, timed when the leg departs and lands on one day) and the chosen stay; `tripText`
  lists them on their days, `tripCalendar` adds one event per leg and one all-day stay from check-in
  to check-out. `TripEditor` passes the interface locale to `tripCalendar`.
- `trip-export.e2e.mjs` and its failure inventory: a round-trip flight, a stay and unchosen
  candidates in the fixture.
- `docs/workspace-ui.md` and its `.zh.md` pair.

## Why

A real all-live run with only a flight and a hotel downloaded a calendar with zero events.

## Validation

- `pnpm --filter @trip/web e2e trip-export` (dev, mock data, credentials blank): on main source with
  the new fixture, fails at "copy selected flights and check-in at 1440px light"; after: 28 ok, exit 0.

## Notes for the next person

Event times are still floating (no `TZID`), as before.
