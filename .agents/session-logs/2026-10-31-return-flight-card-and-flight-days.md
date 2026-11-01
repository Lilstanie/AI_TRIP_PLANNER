---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-219-return-flight-card
pr: pending
area: apps/web
contract-impact: none
---

# Return flight card time, +1 arrival and flight days (TP-219)

## What changed

- The trip flight card shows the flight time of the leg it shows: the return card reads the
  inbound leg, not the fare's outbound duration.
- Timeline flight rows mark a later arrival date with a superscript day offset ("+1"); the helper
  moved from the chat flight card to `lib/trip/timeline.ts` so both use it.
- Chat day cards and the trip day strip say Flight on a day without stops that has a flight, Booked
  on a day with only bookings, and Free day otherwise.

## Why

The live Sydney–Tokyo recheck showed the return card with 22h45 (outbound) instead of 23h55, a
22:05 next-day arrival without +1, and day 1 called "Free day" while the traveller flies.

## Validation

- `tsc --noEmit`, `next lint` and the affected web vitest files (14 files, 166 tests) pass.

## Docs

- `docs/workspace-ui(.zh).md` flight rows, flight card, chat day cards and day strip.
