# Agent Note: iOS app shell around the deployed site

Status: proposed
Owner: C (@HeadmasterEggy)

## Problem

The [no native phone app note](../../implemented/feature/2026-10-14-drop-android-wrapper.md) removed
every phone wrapper and left the PWA as the only way to put the planner on a phone. On 2026-11-01 the
owner asked for an iOS app again, kept on a branch and out of the Stage 2 submission. On an iPhone the
PWA is only reachable through Safari's Share menu, and an Xcode project is the only way to install a
real app icon that does not depend on that menu.

## Proposal

- `apps/ios/` is a Capacitor 8 project (`@trip/ios`) whose web view loads
  `https://elec5620-ai-trip-planner.vercel.app`, so the app always shows the deployed site and needs
  no web build of its own. Swift Package Manager links Capacitor; CocoaPods is not needed.
- `apps/ios/www/index.html` is the offline page from `apps/web/public/offline.html`. Capacitor shows it
  when the site cannot load, and its retry button reopens the deployed URL.
- The app icon is the brand logo rendered at 1024 × 1024 on white.
- Links to other hosts open in Safari, which is Capacitor's default outside `server.url`. The one
  exception is the Clerk host `more-puma-666.clerk.accounts.dev` in `server.allowNavigation`: production
  redirects the first request there, and without it the app opened Safari on launch.
- The app is built in Xcode on the owner's Mac and installed with a free Apple ID (re-signed every
  seven days). It is not sent to TestFlight or the App Store.
- The work stays on `feature/TP-241-ios-app` and is not merged into `main`.

## Alternatives considered

- **Keep only Add to Home Screen**: what the 2026-10-14 note chose. The owner asked for an app instead.
- **SwiftUI app with its own `WKWebView`**: the same result with hand-written navigation, offline and
  external-link handling that Capacitor already provides.
- **Bundle a static export of the web app**: the app needs its API routes and server rendering, so a
  local copy would not plan trips.
- **CocoaPods**: Capacitor 8 defaults to Swift Package Manager, which Xcode resolves without an extra
  tool on the Mac.

## Acceptance criteria

- `pnpm --filter @trip/ios sync` regenerates the Xcode project files without errors.
- The app builds in Xcode, installs on an iPhone and opens the deployed planner with the phone shell
  clear of the status bar and home indicator.
- With the network off, the app shows the offline page; its retry button reopens the site.

## Risks

- A free Apple ID signature expires after seven days, and the bundle id must be unique to that team.
- Production signs in with Clerk. The sign-in page opens in the app; signing in has not been tried. Google blocks its sign-in inside
  embedded web views, so Google sign-in will need to open in Safari; untested so far.
- The sign-in page puts its logo under the status bar in the app, because the page uses
  `viewportFit: "cover"` without a top safe-area inset. The fix is in `apps/web` and shows only once
  deployed.
- The app shows whatever is deployed, so it breaks whenever the production site does.
