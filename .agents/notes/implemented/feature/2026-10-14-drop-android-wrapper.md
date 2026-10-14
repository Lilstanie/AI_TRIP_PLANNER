# Agent Note: No native phone app; the web app stays installable

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

The [installable app note](2026-10-05-installable-app.md) added a Bubblewrap TWA project under
`apps/android-twa/` beside the PWA, and a local `feature/ios-app` branch held an unmerged iOS shell.
Neither shipped: no APK was ever attached to a GitHub Release, `assetlinks.json` stayed unsigned, and
the owner no longer wants to build or sign a phone app. The project still carried 38 Android files, a
public `assetlinks.json`, an APK build guide and two open issues (#173 signed APK, #182 real-device
check) for something nobody was going to release.

## Decision

- `apps/android-twa/`, `apps/web/public/.well-known/assetlinks.json` and the "Building the Android APK"
  guide are removed, along with the two `assetlinks.json` checks in `installable-app.e2e.mjs`.
- The PWA stays: `manifest.ts`, the icons and `sw.js` still make the site installable from Chrome, Edge,
  Safari and Android Chrome, and the 520 px phone shell from the
  [phone shell note](2026-10-05-phone-shell.md) is unchanged.
- #173 and #182 are closed as not planned. The unmerged `feature/ios-app` branch is deleted; its two
  commits, `c01ecbf5` and `72c8e94e`, remain recoverable from the reflog.

## Alternatives considered

**Keep the TWA project but stop maintaining it.** Rejected: 38 files and a documented build flow imply a
supported app, and every skill and doc that names them keeps going stale.

**Also remove the PWA.** Rejected: the manifest and service worker are small web features, and the
phone shell already makes phones usable in a browser without any native packaging.

## Consequences

- No Android or iOS packaging exists. A phone app, if wanted later, starts from the PWA again.
- `pnpm --filter @trip/web e2e installable-app --prod` now runs 22 checks, down from 24.
- Older notes and session logs still describe the removed project; they are history and stay as written.

## Sources

The owner's instruction on 2026-10-14.
