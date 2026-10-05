# Agent Note: Installable app on computer, iPhone and Android

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The workspace only ran in a browser tab. The team wanted it as an app on computers and phones,
built with a Trusted Web Activity (TWA). A TWA exists only on Android, so it cannot cover a computer
or an iPhone on its own, and it requires the site to be a valid Progressive Web App (PWA) first.

## Decision

One PWA serves every platform, and only Android gets a native wrapper:

- **Web**: `apps/web/app/manifest.ts`, PNG and maskable icons from the brand logo, and
  `apps/web/public/sw.js`. The service worker caches only the offline page and its icon; page
  navigations go to the network and fall back to `public/offline.html`, and every other request is
  left alone, because planning, Clerk and the APIs cannot work offline. It registers only in
  production builds.
- **Computer**: install the PWA from Chrome or Edge. **iPhone**: Add to Home Screen.
- **Android**: a Bubblewrap TWA project committed under `apps/android-twa/`, bound to
  `elec5620-ai-trip-planner.vercel.app`. `/.well-known/assetlinks.json` is a public route so Android
  can verify it signed out. The APK is sideloaded for the demo and attached to a GitHub Release, not
  published to Google Play.
- **Signing**: one person (module C) keeps the keystore on their own machine; only its public SHA-256
  fingerprint is committed, in `assetlinks.json` and `twa-manifest.json`.

## Alternatives considered

- **Electron or Tauri on computers**: rejected. It loads the same URL, so it shows nothing more than
  the installed PWA, but adds a separate build, about 150 MB of bundled Chromium, macOS signing and
  Clerk redirect handling.
- **Google Play release**: rejected for now. It needs a paid developer account, review and a privacy
  policy page, and neither the live demo nor the Stage 2 marking needs it. The same signed build can
  be uploaded later.
- **Caching saved trips for offline viewing**: rejected. It would mean syncing signed-in data into
  the cache for little demo value.
- **Generating the Android project on each build instead of committing it**: rejected so others can
  reproduce the build and the work is visible in the repository.

## Consequences

- Until `assetlinks.json` names the release key's fingerprint and is deployed, the Android app shows
  a URL bar at the top. A new keystore means a new fingerprint and reinstalling the app.
- Signing in with Google inside the Android app briefly shows a URL bar on Google's pages; this is
  standard TWA behaviour.
- Bumping the cache name in `sw.js` is the way to replace the cached offline page.
- `apps/web/tests/e2e/installable-app.e2e.mjs` checks the manifest, icons, Chrome installability,
  the service worker, the offline page and `assetlinks.json`. Build steps are in
  [development](../../../../docs/development.md#installable-app).
