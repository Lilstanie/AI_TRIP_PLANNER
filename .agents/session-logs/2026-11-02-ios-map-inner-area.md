---
date: 2026-11-02
author: Claude Code (for Joey)
branch: fix/TP-280-ios-map-panel-resize
pr: pending
area: apps/ios, apps/web
contract-impact: none
---

# iOS Map tab centres a selected stop above its details (TP-280)

## What changed

- `apps/ios/ios/App/App/TripMap.swift`: rects, zoom levels and the fit use the area inside the
  map's layout margins; the centre is no longer offset by hand; the fit computes its zoom directly
  instead of `mapRectThatFits` with the insets added to the padding; margins apply immediately with
  `layoutIfNeeded()`.
- `apps/web/components/map/apple-maps-renderer.ts`: `getCenter()` reads the region when called, so
  TripMap's resize re-centre (captured before its animation frame) never sends a centre that a native
  report has since replaced.
- Agent Note `feature/2026-11-01-ios-native-tabs-and-maps.md`: the margin rule.

## Why

After TP-276 a tapped or restored stop sat 59pt above the centre of the visible area, and once stop 1
was cut off at the top on first open. Native logs from the simulator showed the web insets were right
(top 110, bottom 383) but `visibleMapRect` took the aspect of the area inside `layoutMargins`
(390/371): MapKit already fits rects into the margins, and `rect()` offset the centre a second time
and sized the rect by the full bounds. The same mismatch made every zoom-less camera call zoom out by
log2(864/371) = 1.22 levels. The good first-open run had an extra web `camera` to the city centre
about 90 ms after the fit, from the resize re-centre using a centre captured before the fit report.

## Validation

- `ios-app-shell` E2E 14/14; web `tsc --noEmit` and `eslint` on the renderer pass.
- The log arithmetic: predicted pin tip 233.9pt, measured 233; predicted stop 1 at 120.8pt, under
  the top bar.
- Swift not compiled in the cloud container; the Mac build and simulator run cover it.
