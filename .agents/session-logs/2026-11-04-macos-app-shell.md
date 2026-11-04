---
date: 2026-11-04
author: Claude Code
branch: feature/macos-app
pr: pending
area: apps/macos, docs
contract-impact: none
---

# Add a native macOS app that opens the deployed planner

## What changed

- `apps/macos/`: Swift package `TripPlannerMac` (SwiftUI window, `WKWebView`, menus, link policy,
  JavaScript dialogs, file uploads, downloads, offline page) plus `Resources/` and
  `scripts/build-app.sh`, which assembles and signs `build/AI Trip Planner.app`.
- `Resources/AppIcon.png`: the iOS icon placed in the macOS rounded-square grid.
- `docs/development.md` and `docs/development.zh.md`: a macOS app section with the build command.
- Agent Note `implemented/feature/2026-11-04-macos-app-shell.md` records the decision.

## Why

The owner chose a native shell over Mac Catalyst (phone-only native layer) and Electron (ships
Chromium). The rest of the rationale is in the note.

## Validation

- `bash -n apps/macos/scripts/build-app.sh`: no syntax errors. The script itself exits 1 on Linux by
  design ("needs macOS").
- `Resources/Info.plist` parses with Python `plistlib`.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm format:check-changed`:
  results in the pull request.
- Not compiled: the container has no Swift toolchain, AppKit or WebKit.

## Notes for the next person

- Run `apps/macos/scripts/build-app.sh` on a Mac first and fix any compile errors.
- Google sign-in through Clerk will not finish inside the web view.
