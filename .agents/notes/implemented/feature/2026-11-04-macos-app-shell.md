# Agent Note: macOS app as a native WKWebView shell

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

On 2026-11-04 the owner asked for a Mac app. The [iOS app shell](2026-11-01-ios-app-shell.md) covers
the iPhone only, and on a Mac the planner was a Safari tab or a Dock web app with no app menus, no
offline page and no control over which links leave the planner.

## Decision

- `apps/macos/` is a Swift package with one executable target, `TripPlannerMac`, built for macOS 13
  and later. A SwiftUI `WindowGroup` holds a `WKWebView` that opens
  `https://elec5620-ai-trip-planner.vercel.app`, as the iOS app does, so the Mac app always shows the
  deployed desktop workspace and has no web build of its own.
- `scripts/build-app.sh` runs `swift build`, puts the binary, `Resources/Info.plist`, the offline page
  and an `.icns` made from `Resources/AppIcon.png` into `build/AI Trip Planner.app`, and signs it ad hoc
  (or with `SIGN_IDENTITY`). It needs the Command Line Tools, not an Xcode project.
- The web view appends `TripPlannerMacApp` to its user agent. The web app does not read it yet; a
  Mac-only style layer can key on it the way `data-shell="ios-app"` keys on `TripPlannerIOSApp`.
- The deployed host and the Clerk host `more-puma-666.clerk.accounts.dev` stay in the app, with
  `about:`, `blob:`, `data:`, `file:` and subframe loads. Every other link, including `window.open` and
  `target="_blank"`, opens in the default browser.
- The web view needs native code for what Safari does itself: `alert`, `confirm` and `prompt` show
  `NSAlert`s (the workspace asks `confirm` before a new plan replaces the traveller's own edits), file inputs show `NSOpenPanel`
  (chat attachments, Agent Lab imports), and downloads such as `trip.ics` and replay artifacts ask
  where to save with `NSSavePanel`.
- When the first load fails because the Mac is offline, the app shows `Resources/offline.html`, the
  iOS offline page with a relative icon; Reload Page or its retry button reopens the site. A crashed
  web content process reloads.
- Menus add Reload Page (⌘R), Actual Size, Zoom In and Zoom Out (⌘0, ⌘=, ⌘-) to View, and a Go menu with
  Back (⌘[), Forward (⌘]) and Home (⇧⌘H). ⌘N opens another window with its own web view; all windows
  share one cookie store, so one sign-in covers them.
- The icon is the iOS icon inside the macOS rounded-square grid (824 px tile on a 1024 px canvas).
- The bundle id is `app.vercel.elec5620aitripplanner.mac`, so it never collides with the iOS app.

## Alternatives considered

- **Mac Catalyst from the iOS target**: little new code, but it brings the phone tab bar and Apple Maps
  layer, which are built for a portrait iPhone, into a desktop window.
- **Electron**: testable on Linux CI, but ships Chromium, adds a large dependency and is not a native
  Mac app. The owner chose the native shell.
- **An Xcode project**: a hand-written `project.pbxproj` cannot be checked outside Xcode; a Swift
  package opens in Xcode and also builds from the command line.

## Consequences

- Web changes reach the app after a production deploy, and the app breaks whenever production does.
- The Swift code was written in a Linux container without a Swift toolchain, AppKit or WebKit; it has
  not been compiled or launched yet. Build it on a Mac before relying on it.
- An ad hoc signature runs only on the Mac that built it; another Mac needs a Developer ID signature
  and notarisation, or the user must allow it under System Settings → Privacy & Security.
- Google blocks its sign-in inside embedded web views, and the app sends `accounts.google.com` to the
  browser, so Google sign-in through Clerk will not complete in the app. Other sign-in methods are untried.
- No E2E covers the shell: browser emulation cannot run WKWebView or AppKit. The web app has no Mac
  branch to test either, since it ignores the marker.

## Sources

The owner's request in the project thread on 2026-11-04 ("做一个 macapp 出来") and their choice of a
native macOS shell over Mac Catalyst and Electron.
