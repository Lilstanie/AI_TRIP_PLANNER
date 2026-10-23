---
date: 2026-10-22
author: Claude Code
branch: fix/calendar-trip-bar-label
pr: none
area: apps/web, docs
contract-impact: none
---

# Calendar trip label spans its week of the bar

## What changed

- `apps/web/components/workspace/TripsPage.tsx`: the labelled segment of a trip bar (its start, or a
  week's Monday) sets the label width to the trip's remaining days in that week row (#568).
- `apps/web/app/styles/workspace-trips.css`: that segment is raised above the following segments and
  its label is positioned across them with an ellipsis. Compact duplicate labels (`Syd·2`) unchanged.
- `apps/web/tests/e2e/calendar-trip-label-span.e2e.mjs` and its failure inventory (written first).
- `docs/workspace-ui.md` and its Chinese pair.

## Why

Each day of a bar is its own button, and the label lived in the first one with `overflow: hidden`,
so "Sydney & Wollongong" read "Sydney" in a 49 px cell on the phone.

## Validation

- `node scripts/redgreen.mjs calendar-trip-label-span -- apps/web/components/workspace/TripsPage.tsx
  apps/web/app/styles/workspace-trips.css`: before exit 1, 7/11 ok; after exit 0, 11/11 ok.
- `calendar-trip-identity-search` 33 ok and `calendar-bar-contrast` 13 ok. `calendar-trip-date-label`
  has the same 6 failures with and without this change ("Auckland: short title names the month",
  "active trip title includes its locale-formatted date range").

## Notes for the next person

The label width is the segment width times the days, minus `--space-2`; it ends a little before the
bar's end rather than measuring each segment.
