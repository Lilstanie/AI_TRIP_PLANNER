---
date: 2026-11-04
author: Claude Code
branch: fix/ios-map-taps-and-tabs
pr: none
area: apps/ios, apps/web/tests
contract-impact: none
---

# iOS map taps, native tab selection and touch detection without MapKit internals

## What changed

- `apps/ios/ios/App/App/TripMap.swift`: a single-tap recogniser sends `mapTap`, ignoring touches on
  enabled annotation views and waiting for a double tap to fail; `didDeselect` no longer sends it.
  Own pan and pinch recognisers (simultaneous with MapKit's) replace the read of
  `mapView.subviews.first?.gestureRecognizers` in `regionWillChangeAnimated`.
- `apps/ios/ios/App/App/TripShell.swift`: `didSelect` restores the last selection the web reported;
  `apply` sets the selection, including none, from each `setTabs`.
- `apps/web/tests/e2e/ios-app-shell.e2e.mjs`: checks that `mapTap` closes an open stop, that relayed
  tab taps the web ignores send no `setTabs`, and that a switching tap reports the new tab.
- Updated the [native tabs and maps note](../notes/implemented/feature/2026-11-01-ios-native-tabs-and-maps.md).

## Why

A pan recogniser of ours may begin one touch event after MapKit's region change starts, so its
`.began` action also reports the gesture; a pinch that moves nothing clears the flag on end.

## Validation

- `pnpm --filter @trip/web e2e ios-app-shell` with `PLAYWRIGHT` set to the preinstalled Playwright:
  17/18 on the first run (dark sign-in padding, a check this change does not touch, read 24px),
  then 18/18 twice. With the change stashed: 15/15.
- No Xcode, `swift` or `swiftc` in the Linux session: the Swift is not compiled.

## Notes for the next person

- Build in Xcode and try on a device: tap empty map with and without a pin selected, double-tap zoom,
  tap pin to pin, pan, pinch, and a tab tap that the web ignores.
- A pure two-finger rotation does not count as a touch gesture; add a rotation recogniser if needed.
- The dark sign-in status-bar check in `ios-app-shell` failed once in four runs.
