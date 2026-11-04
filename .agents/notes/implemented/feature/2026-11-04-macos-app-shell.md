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
- The web view appends `TripPlannerMacApp` to its user agent. The inline script in `app/layout.tsx`
  that marks the iOS app sets `data-shell="mac-app"` on `<html>` before first paint when it sees that
  marker, and `app/styles/mac-app.css` styles only that state. Safari, the PWA and the iOS app never
  get it.
- The Mac layer makes the page behave like a Mac window rather than a web page: buttons, tabs, menu
  items and other controls use the arrow cursor (links keep the pointing hand), their labels cannot be
  selected, images and icons cannot be dragged out, and the window does not rubber-band. Chat replies,
  the itinerary and text fields stay selectable. The web's thin `::-webkit-scrollbar` styles on panels,
  the chat stream and the day strip apply everywhere except the app, so the app shows the system
  overlay scrollbars.
- The title bar is transparent and takes the web view's `underPageBackgroundColor`, which follows the
  page background, so it matches the light or dark page colour and a saved appearance override.
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
- Browser emulation cannot run WKWebView or AppKit, so no E2E covers the native shell or the title bar
  tint. `apps/web/tests/e2e/mac-app-shell.e2e.mjs` checks the web layer at 1440 × 900 in light and
  dark: the marker in the server HTML, arrow cursors and unselectable labels in the sidebar and top
  bar, selectable fields, replies and itinerary, no overscroll, no web scrollbar rules, and that Safari
  on a Mac and the iOS app are unchanged. It writes screenshots and `result.json` to
  `output/playwright/mac-app-shell/`; its failure list is `mac-app-shell.failures.md`.

## Sources

The owner's requests in the project thread on 2026-11-04 ("做一个 macapp 出来", then "给网页加上 Mac
专属样式") and their choice of a native macOS shell over Mac Catalyst and Electron.
