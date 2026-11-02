# Agent Note: native tab bar and Apple Maps in the iOS app

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The [iOS app shell](../../implemented/feature/2026-11-01-ios-app-shell.md) shows the deployed site in a
web view, so its tab bar and map are web imitations of iOS. The owner asked for a hybrid instead: the
system tab bar with real Liquid Glass and Apple Maps on the Map tab, with chat and the trip staying web.

## Decision

- The site does not bundle `@capacitor/core`, so `Capacitor.Plugins` is never filled in the app.
  `components/pwa/native-shell.ts` calls the bridge Capacitor injects (`Capacitor.nativePromise` and
  `Capacitor.addListener`) and offers a plugin only when the app is marked and the plugin's header is
  present. Haptics and the keyboard hook use it too; they were silent before.
- `TripShell.swift` replaces the root view controller. Its `TripShell.setTabs` plugin receives the web
  tabs (id, label, badge dot, selected, hidden) from a mutation observer in `ios-app-bridge.tsx` and
  shows them in a `UITabBar`. A tap on a native tab clicks the matching web tab. The web tab bar stays
  in the page as an invisible spacer of the native bar's height, so layout and tab state stay web.
- The workspace Map tab on the phone uses a third map renderer, `apple-maps-renderer.ts`, behind the
  same `MapsSDK` seam as Google Maps and MapLibre. It sends the camera, stop pins (number, day colour,
  name, selected), route lines and travel-mode badges to the `TripMap` plugin in `TripMap.swift`, which
  draws them on an `MKMapView` placed under the web view's content. Pins use `MKMarkerAnnotationView`,
  so MapKit lays out and hides crowded names.
- Only the Map tab's map uses it. Other phone maps, such as the trip home preview, keep Google Maps or
  MapLibre, because the cleared backgrounds above a small native map turned the whole page black.
- While the map is visible the web marks the map's ancestors with `data-native-map-hole` and clears
  their backgrounds, and reports the map's frame and the web panels over it (top bar, tab bar, day
  sheet, popup, controls). The web view sends a touch to the map only when it is inside the frame and
  outside every panel.
- Native events come back as the Google-style events `TripMap` already listens to: `dragstart`,
  `zoom_changed`, `center_changed`, `idle` and `click`, and a pin tap fires the web marker's `gmp-click`.
- The app asks for location while in use, so the map's location button works in the web view.

## Alternatives considered

- **MapKit JS in the web view**: needs a paid Apple Developer account for its token.
- **Rewrite the app in SwiftUI**: the owner chose the hybrid; chat and trip editing stay one codebase.
- **Keep markers as web elements positioned over the native map**: they would lag a frame behind every
  pan and pinch.
- **Ask the page at touch time whether a point is covered**: JavaScript cannot answer synchronously
  inside native hit-testing, so the page reports panels ahead of time.

## Consequences

- The native parts need a new Xcode build and the web parts a production deploy. An app built before
  this change keeps the web tab bar and map; Safari and the PWA never see either.
- The Swift code compiled on the owner's Mac with no warnings and the app launched in the iOS
  Simulator; the native tab bar and Apple Maps still need a check against the deployed site.
- A web panel missing from the reported list lets touches through to the map; add its selector to
  `OCCLUDERS` in `apple-maps-renderer.ts`.
- Satellite view works on Apple Maps; the animated route dashes are Google-only.
- `apps/web/tests/e2e/ios-app-shell.e2e.mjs` checks the bridge with a fake native plugin: tab mirroring,
  relayed taps, the Map tab's frame, pins and routes, a cleared backdrop, and a pin tap opening the
  stop. Browser emulation cannot show MapKit.

## Sources

The owner's requests in the project thread on 2026-11-01 ("可以，做 1").
