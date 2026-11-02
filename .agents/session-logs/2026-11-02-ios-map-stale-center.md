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
  renderer's region and sends nothing when no field changed; the layout bottom inset also stops at
  an open stop's details panel, not only the Day stops sheet.
- `apps/ios/ios/App/App/TripMap.swift`: camera moves and region reports use the centre of the
  inset area; a change of insets before any touch repeats the last fit or camera move.
- Agent Note `feature/2026-11-01-ios-native-tabs-and-maps.md`: the gesture-only move events, the
  stale-region rule and the inset-area centre.

## Why

The third simulator retest (after TP-270) still opened the Map tab at city zoom on the destination
centre and lost hand pans on tab switches. A recorded run of the native calls showed `fit` followed by
`camera` with the create centre: TripMap's resize observer re-centres on `getCenter()`, which on the
Apple renderer still held the create centre, and a camera call while the map is unsized replaces the
pending fit.

A local-server retest of the web fix on the Mac passed framing, tab switches and pans, but stop 4 sat
behind the expanded Day stops sheet and a restored selected stop was not centred above it: the native
map centred on its full frame and fitted with the insets of its first layout only.

## Validation

- Scratch Playwright run with a recording `TripMap` plugin: before, `fit` then
  `camera(-33.796, 151.213)`; after, `fit` only, and Chat -> Map sends no camera call.
- `ios-app-shell` E2E 14/14.
- Mac simulator against a local dev server (web fix only): framing at city level, Chat -> Map
  unchanged, pan kept, pin tap opens the stop. The Swift change has not been built here (no Swift
  toolchain in the cloud container); the Mac rebuild covers it.
- Mac simulator with the Swift change (local dev server): build succeeded; all stops framed above
  the expanded sheet, re-framed when it collapsed, a hand pan kept through sheet changes and tab
  switches. A tapped or restored stop was centred horizontally but sat low, because the inset ignored
  the details panel; the scratch run now reports a bottom inset of 383 with the panel open (100
  before).

## Notes for the next person

Needs a simulator rebuild on the Mac to confirm framing and pan.
