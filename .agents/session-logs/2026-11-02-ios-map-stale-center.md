---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-276-ios-map-stale-center
pr: pending
area: apps/web
contract-impact: none
---

# iOS Map tab keeps its fit and the traveller's pan (TP-276)

## What changed

- `apps/web/components/map/apple-maps-renderer.ts`: `move` drops camera fields equal to the
  renderer's region and sends nothing when no field changed.
- Agent Note `feature/2026-11-01-ios-native-tabs-and-maps.md`: the gesture-only move events and the
  stale-region rule.

## Why

The third simulator retest (after TP-270) still opened the Map tab at city zoom on the destination
centre and lost hand pans on tab switches. A recorded run of the native calls showed `fit` followed by
`camera` with the create centre: TripMap's resize observer re-centres on `getCenter()`, which on the
Apple renderer still held the create centre, and a camera call while the map is unsized replaces the
pending fit.

## Validation

- Scratch Playwright run with a recording `TripMap` plugin: before, `fit` then
  `camera(-33.796, 151.213)`; after, `fit` only, and Chat -> Map sends no camera call.
- `ios-app-shell` E2E 14/14.

## Notes for the next person

Needs a simulator rebuild on the Mac to confirm framing and pan.
