---
date: 2026-10-21
author: Claude Code for Joey
branch: fix/trip-drawer-narrow-split
pr: none
area: apps/web
contract-impact: none
---

# Trip drawer fits the narrowest desktop split

## What changed

- `apps/web/app/styles/timeline.css`: a `timeline` container query at 240 px or narrower drops the
  time column; the time sits above the stop's body and the rail moves to the node column.
- `apps/web/app/styles/workspace-drawers.css`: the drawer budget line wraps.
- `apps/web/tests/e2e/trip-drawer-narrow-split.e2e.mjs`: at 1024 and 1440 px, English and Chinese,
  presses End on the split and reports any drawer element past the drawer edge or clipped, ignoring
  content inside intentional horizontal scrollers such as the day strip.

## Why

Root-cause audit (#498): at a 1024 px window the drawer is 181 px wide. Timeline rows kept a 56 px
time column, the 24 px node column and two gaps, leaving 45 px for the stop, so the row's cost
and name pushed the drawer to 199 px of scroll width. The budget line `Estimated total` plus its
amount was a non-wrapping flex row.

## Validation

`pnpm --filter @trip/web e2e trip-drawer-narrow-split workspace-control-overflow timeline narrow-time-editor --prod`:
all pass. The new script failed before the change (scroll width 199 for 181 px in English, 186 in
Chinese).

## Notes for the next person

At 181 px long words still break mid-word in stop names; that is wrapping, not clipping.
