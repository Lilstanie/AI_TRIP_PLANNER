# Agent Note: iOS app shell with an app-only liquid-glass layer

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The [no native phone app note](../../archived/feature/2026-10-14-drop-android-wrapper.md) removed every
phone wrapper and left the PWA as the only way to put the planner on a phone. On 2026-11-01 the owner
asked for an iOS app again, kept out of the Stage 2 submission, and asked for it to look like an iOS
app with liquid-glass surfaces rather than a web page in a frame. On an iPhone the PWA is only
reachable through Safari's Share menu, and an Xcode project is the only way to install a real app icon.

## Decision

- `apps/ios/` is a Capacitor 8 project (`@trip/ios`) whose web view loads
  `https://elec5620-ai-trip-planner.vercel.app`, so the app always shows the deployed site and needs no
  web build of its own. Swift Package Manager links Capacitor; CocoaPods is not needed.
- `apps/ios/www/index.html` is the offline page from `apps/web/public/offline.html`. Capacitor shows it
  when the site cannot load, and its retry button reopens the deployed URL.
- The app icon and splash are the brand logo on white.
- Links to other hosts open in Safari, Capacitor's default outside `server.url`. The exception is the
  Clerk host `more-puma-666.clerk.accounts.dev` in `server.allowNavigation`: production redirects the
  first request there, and without it the app opened Safari on launch.
- The app appends `TripPlannerIOSApp` to its user agent. An inline script in `app/layout.tsx` sets
  `data-shell="ios-app"` on `<html>` before first paint when it sees that marker, and
  `app/styles/ios-app.css` styles only that state. Safari, the PWA and desktop never get the attribute.
- The app layer makes the existing glass tokens clearer (58 % tint, 30 px blur, 190 % saturation,
  stronger rim highlights), puts a soft colour backdrop behind the phone workspace and sign-in page so
  the glass has something to show through, gives the selected tab a raised lens, rounds the composer
  and bottom sheets to 28 px, adds press feedback and removes the tap highlight and long-press callout
  on controls. Reduced transparency and higher contrast fall back to solid surfaces.
- In the app every field is 16 px, because iOS zooms the page when a smaller field takes focus and the
  web view did not zoom back out. The sign-in page adds the top and bottom safe-area insets, which it
  lacked under `viewportFit: "cover"`.
- The app is built in Xcode on the owner's Mac and installed with a free Apple ID (re-signed every
  seven days). It is not sent to TestFlight or the App Store.

## Alternatives considered

- **Keep only Add to Home Screen**: what the 2026-10-14 note chose. The owner asked for an app instead.
- **Native SwiftUI tab bar over the web view for real Liquid Glass**: the only way to get the system
  material, but it needs a JavaScript bridge for tab state, badges and keyboard hiding. Left for later.
- **SwiftUI app with its own `WKWebView`**: the same result with hand-written navigation, offline and
  external-link handling that Capacitor already provides.
- **Bundle a static export of the web app**: the app needs its API routes and server rendering.
- **Point the app at a branch preview**: Vercel previews sit behind Vercel sign-in, so the web view
  cannot load them; the owner chose to merge the app-only layer into `main` instead.
- **Detect the app on the server from the user agent**: makes the root layout dynamic for every page;
  the inline script keeps static rendering.

## Consequences

- Web changes reach the app only after a production deploy, and the app breaks whenever production does.
- A free Apple ID signature expires after seven days, and the bundle id must be unique to that team.
- Production signs in with Clerk. The sign-in page opens in the app; Google blocks its sign-in inside
  embedded web views, so Google sign-in will need to open in Safari. Not yet tried.
- Browser emulation cannot show real safe areas, keyboard or backdrop rendering in WebKit; check those
  on the iOS Simulator or an iPhone.
- `apps/web/tests/e2e/ios-app-shell.e2e.mjs` checks the marker, 16 px fields, glass tab bar and
  sign-in insets in light and dark, and that Safari on iPhone is not marked; it writes screenshots to
  `output/playwright/ios-app-shell/`.

## Sources

The owner's requests and choices in the project thread on 2026-11-01.
