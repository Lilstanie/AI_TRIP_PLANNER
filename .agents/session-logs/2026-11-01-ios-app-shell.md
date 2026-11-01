---
date: 2026-11-01
author: Claude Code for Joey
branch: feature/TP-241-ios-app
pr: none
area: apps/ios, docs, .agents/notes
contract-impact: none
---

# iOS app shell around the deployed site (TP-241)

## What changed

- `apps/ios/` (new, `@trip/ios`): Capacitor 8 project with Swift Package Manager; `capacitor.config.json` points the web view at `https://elec5620-ai-trip-planner.vercel.app`, and `www/index.html` is the offline page with a retry that reopens that URL.
- App icon and splash rendered from `apps/web/public/brand/ai-trip-planner-logo.svg` on white; the generated `AppDelegate.swift` lost its template comments.
- `docs/development.md` and `.zh.md`: build and install steps under the installable app section.
- Proposed note `.agents/notes/proposed/feature/2026-11-01-ios-app-shell.md`, which would supersede the 2026-10-14 no-native-app decision if this ever lands on `main`.

## Why

Joey asked for an iOS app on 2026-11-01 and said it stays on a branch, outside the Stage 2 submission and `main`.

## Validation

- `npx cap add ios` generated the Xcode project on Linux without errors.
- `pnpm verify:docs` and `pnpm verify:pairs` passed. Building and installing on an iPhone needs Xcode on Joey's Mac and had not run when this log was written.

## Notes for the next person

The branch is not meant to be merged. Signing uses Joey's free Apple ID team, set in Xcode, so `DEVELOPMENT_TEAM` is not committed.

## Follow-up: app-only liquid-glass layer

- Joey asked for the iOS app to look like an iOS app with liquid glass, then chose to merge the app-only layer into `main` after the Stage 2 deadline, because the app loads production and Vercel previews sit behind Vercel sign-in.
- `capacitor.config.json` appends `TripPlannerIOSApp` to the user agent and allows the Clerk host; `app/layout.tsx` marks `<html data-shell="ios-app">` before paint; `app/styles/ios-app.css` holds the whole layer (clearer glass, colour backdrop, lens tab, 16 px fields, sign-in safe areas, press feedback).
- On Joey's Mac the app ran in the iPhone 17e simulator: home and signed-in planner loaded with the top bar and tab bar clear of the status bar and home indicator; the sign-in logo sat under the status bar and focusing a field zoomed the page. Both are fixed in the layer, not yet seen in the simulator because they need a production deploy.
- Notes: the proposal moved to `implemented/` and the 2026-10-14 no-native-app note is archived; inbound links and the ui-verification skill were repaired.
- `node apps/web/tests/e2e/ios-app-shell.e2e.mjs` against `pnpm --filter @trip/web dev` (mock data): 5/9 before the change, 9/9 after. `pnpm --filter @trip/web typecheck`, `verify:docs`, `verify:pairs` and `check-ui-copy.mjs` passed.

## Follow-up: native feel

- Joey asked to keep improving the app's interface and features. Added `@capacitor/haptics` and `@capacitor/keyboard` with `components/pwa/ios-app-bridge.tsx` (tab tick, submit tap, no keyboard accessory bar), portrait-only iPhone, a launch screen that follows light or dark appearance, full-row segmented controls, and a glass search field with larger titles on Mine.
- Not done, for Joey to decide: full-screen map under floating bars, Chat empty-state content (conflicts with the one-sentence empty-screen rule from #738), renaming Mine, moving the data-mode button again, a native SwiftUI tab bar.
- The native changes need a new Xcode build on Joey's Mac; haptics and the accessory bar are untested on a device.
- Joey left the open choices to Claude ("听你的"): the Map tab map now runs under the floating top bar and tab bar in the app; the Chat empty state and the Mine/data-mode button stay as they are.
