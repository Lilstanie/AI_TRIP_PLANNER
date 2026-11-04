---
date: 2026-11-04
author: Claude (refinement sweep)
branch: fix/ios-shell-sync
pr: pending
area: apps/ios, apps/web
contract-impact: none
---

# iOS shell: native tabs and map stay in step with the page

## What changed

- `apps/web/components/pwa/ios-app-bridge.tsx`: the tab mirror observes text changes, and a failed
  `setTabs` clears its dedupe key so the next change sends again.
- `apps/web/components/map/apple-maps-renderer.ts`: re-measures on `transitionend`, so the native
  map's visible area and touch frame follow the day sheet's height animation.
- `apps/ios/ios/App/App/TripShell.swift`: on each page load start (`isLoading`), clears the native map
  and hides the native tab bar, which an unloading page never cleans up.
- `apps/ios/ios/App/App/Info.plist`: `UIRequiredDeviceCapabilities` is `arm64`, not `armv7`.
- `ios-app-shell.e2e.mjs` (+ failures inventory) and the native tabs and maps Agent Note facts.

## Validation

- `LABEL=before node apps/web/tests/e2e/ios-app-shell.e2e.mjs` with the two web fixes stashed:
  "a tab label's text change reaches the native tab bar" FAIL (`"Chat"`). With layout logging, the
  sheet collapse sent no layout call and the floor stayed at 523 against a sheet top of 705.
- With the fixes, two runs: both new checks pass (`"聊天"`, floor 705 = 705).
- `dark: sign-in page clears a 47px status bar` failed in the before run and in one of the two after
  runs on the dev server; it is unrelated (the sign-in route recompiles in dev).

## Notes for the next person

- The Swift change was not compiled: this Linux container has no Swift toolchain. Build it in Xcode
  and check that a reload or sign-out removes the old map and tab bar.
- Other audit findings not fixed here: map bounds near the antimeridian (`TripMap.swift`
  `settle`), native tab selection drifting when a relayed click does nothing, and `mapTap` firing only
  when a pin was selected.
