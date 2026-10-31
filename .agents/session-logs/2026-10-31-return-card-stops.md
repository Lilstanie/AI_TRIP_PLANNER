---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-222-rejected-google-map
pr: pending
area: apps/web/components/trip
contract-impact: none
---

# Return flight card shows the return leg's stops (TP-221)

## What changed

- The trip flight card takes its stops from the leg it shows, so the return card shows the return
  leg's stops (the part of TP-221 that #867 did not cover).

## Not changed

- A first attempt hid a rejected Google map instead of removing it, to stop page errors from
  Google's script when the browser key is rejected. A live Mac run with the expired key still showed
  the same `getRootNode` and `setAttribute` errors in 11 of 14 opens with the map kept in the page,
  so that change was reverted; the errors are not caused by removing the map.

## Validation

- `apps/web`: `tsc --noEmit`, `next lint`, vitest for trip, workspace and map components pass.
- Live Mac run: return card shows 23h55 and 1 stop; return row 20:10 → 22:05+1; chat day 1 says
  Flight.

## Docs

- `docs/workspace-ui(.zh).md` flight card.
