---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/ios-map-bounds
pr: pending
area: apps/ios
contract-impact: none
---

# Apple Maps reports visible bounds that wrap the antimeridian

## What changed

- `apps/ios/ios/App/App/TripMap.swift`: the `region` event's north, south, east and west come from
  the corners of `visibleMapRect`, with longitudes wrapped into −180…180 (−180 to 180 when the whole
  world is visible), instead of `region.center ± span / 2`.

## Why

`center ± span / 2` is not wrapped, so a map over Fiji or Tonga reported `east: 190`, and the web
renderer's `getBounds().contains` (which already handles west > east) said a stop at −175° was off
screen. Latitude from a centred span is also wrong under Mercator when zoomed out.

## Validation

- Not compiled: this Linux container has no Swift toolchain. Reviewed against
  `apps/web/components/map/apple-maps-renderer.ts` `getBounds()`, which accepts a wrapped pair.

## Notes for the next person

- Build in Xcode and open a trip across the antimeridian (Fiji) on the Map tab.
