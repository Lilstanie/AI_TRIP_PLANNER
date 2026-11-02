---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-285-phone-map-deselect
pr: pending
area: apps/web
contract-impact: none
---

# Closing a stop clears it on the phone; trip home map controls (TP-285)

## What changed

- `components/map/TripMap.tsx`, `TripMapCanvas.tsx`, `workspace/WorkspaceView.tsx`: closing a stop's
  details on the phone Map tab (X, Escape or a tap on the map) clears the selected stop, so it is no
  longer highlighted or restored on the next launch. Desktop keeps its behaviour.
- `app/styles/phone/map.css`: the top-row map controls apply only to the phone Map tab. The trip home
  map keeps the column at the bottom right, and its place status moves to the bottom left.

## Why

iOS simulator retests: a selected stop could not be cleared and came back on every relaunch; on the
trip home map the controls, the map attribution and the place status all sat in the top 70px and
covered each other.

## Validation

- Scratch Playwright run (iOS app user agent, mock Sydney trip): after a stop tap the stored selection
  is the stop; after closing the details it is null and the details are gone.
- Trip home screenshot at 390px: controls in a column at the bottom right, status at the bottom left,
  attribution alone at the top.
- `ios-app-shell` E2E 14/14; web `tsc --noEmit` and `pnpm lint` pass; `check-ui-copy` passes.

## Notes for the next person

Apple Maps pins can sit on base-map neighbourhood labels: MapKit does not move base labels around
annotations. Left as is.
