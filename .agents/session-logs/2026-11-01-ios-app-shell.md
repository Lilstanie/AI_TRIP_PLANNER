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
