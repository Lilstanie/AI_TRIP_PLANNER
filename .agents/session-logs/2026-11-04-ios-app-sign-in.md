---
date: 2026-11-04
author: Claude Code
branch: feature/macos-app
pr: 972
area: apps/ios, apps/web/tests, docs
contract-impact: none
---

# Keep Apple and GitHub sign-in inside the iOS app

## What changed

- `apps/ios/ios/App/App/TripShell.swift`: a `TripLinks` plugin whose `shouldOverrideLoad` allows
  the paths in `plugins.TripLinks.signInPaths`; registered in `capacitorDidLoad`. It lives in an
  existing file so `project.pbxproj` needs no new entry.
- `apps/ios/capacitor.config.json`: the same Apple and GitHub paths as the Mac app.
- The sign-in E2E moved from `apps/macos/tests/` to `apps/web/tests/app-shells/` and now runs both
  shells, plus checks that the Swift code reads the files the test reads.
- iOS and macOS Agent Notes and `docs/development.md` / `.zh.md`.

## Why

The iOS app had the same problem as the Mac app: Capacitor opened every host outside `server.url` and
`allowNavigation` in Safari. `allowNavigation` matches hosts only, so a plugin keeps it to sign-in
paths. Google stays in Safari, as the owner chose for the Mac app.

## Validation

- `PLAYWRIGHT=/opt/node22/lib/node_modules/playwright node apps/web/tests/app-shells/sign-in-links.e2e.mjs`:
  14/14. `RULES=app-hosts-only` (old rules, both shells): 8/12, Apple and GitHub fail on mac and ios.
- Renaming the key in `TripShell.swift` to `signInPath` turned the iOS wiring check red (1/2); reverted.
- Swift not compiled here; the iOS app needs `pnpm --filter @trip/ios sync` and an Xcode build.

## Notes for the next person

- Try a full Apple or GitHub sign-in on an iPhone.
