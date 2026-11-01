---
date: 2026-11-01
author: Claude Code for Joey
branch: feature/TP-253-ios-native-tab-bar
pr: none
area: apps/ios, apps/web/components/map, apps/web/components/pwa, docs, .agents/notes
contract-impact: none
---

# Native tab bar and Apple Maps in the iOS app (TP-253)

## What changed

- `apps/ios/ios/App/App/TripShell.swift`: root view controller with a system `UITabBar` that mirrors the web tabs (`TripShell.setTabs`) and a pass-through web view.
- `apps/ios/ios/App/App/TripMap.swift`: `TripMap` plugin drawing pins, routes and the camera on an `MKMapView` under the web content; location permission string in `Info.plist`.
- `apps/web/components/pwa/native-shell.ts`: calls Capacitor's injected bridge directly. The earlier `Capacitor.Plugins` lookup never worked on the real site, so haptics and the keyboard hook were silent.
- `apps/web/components/map/apple-maps-renderer.ts`: third renderer behind the `MapsSDK` seam, used for the phone workspace map in the app; `decodePath` moved to `lib/map/polyline.ts`.
- Proposed note `2026-11-01-ios-native-tabs-and-maps.md`; development docs link it.

## Why

Joey asked for the hybrid app ("做 1"): native tab bar and Apple Maps, chat and trip stay web.

## Validation

- `apps/web/tests/e2e/ios-app-shell.e2e.mjs` with a fake native plugin: 14/14 checks, including the map frame, two pins with day colours, route lines, a cleared backdrop and a pin tap opening the stop.
- `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`, comment policy, file length, E2E selector and artifact checks, `pnpm verify:docs`.
- The Swift code has not been compiled; it needs Xcode on Joey's Mac.

## Notes for the next person

Build on the Mac with low concurrency (16 GB machine). If a web panel over the map lets touches through, add it to `OCCLUDERS`.
