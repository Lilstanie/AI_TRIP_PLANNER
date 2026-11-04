---
date: 2026-11-04
author: Claude Code
branch: feature/macos-app
pr: 972
area: apps/web, apps/macos, docs
contract-impact: none
---

# Give the web app a Mac-only layer for the macOS app

## What changed

- `app/layout.tsx`: the first-paint shell script also sets `data-shell="mac-app"` for
  `TripPlannerMacApp`.
- `app/styles/mac-app.css`: arrow cursor and unselectable labels on controls, undraggable images,
  no overscroll. `base.css` and `trip/timeline.css` scope the web scrollbars away from the app.
- `apps/macos`: the title bar is transparent and tinted with `underPageBackgroundColor`.
- `tests/e2e/mac-app-shell.e2e.mjs` and `mac-app-shell.failures.md` (written before the code).
- Agent Note and `docs/development.md` / `.zh.md` updated.

## Why

A WKWebView shell otherwise behaves like a web page: pointing-hand cursors, selectable button labels,
whole-window rubber-banding and web scrollbars. The note records the scope.

## Validation

- `PLAYWRIGHT=/opt/node22/lib/node_modules/playwright pnpm --filter @trip/web e2e mac-app-shell`:
  23/23 checks passed. With the web changes stashed (`LABEL=before`): 12/23, the 11 Mac-layer checks
  fail. The project's Playwright browser was missing in this container, hence `PLAYWRIGHT`.
- Swift still not compiled: no toolchain in the container.

## Notes for the next person

- The title bar tint and the Swift changes need a build on a Mac.
- Headless Chromium hides scrollbars, so the E2E checks the scrollbar rules through the CSSOM.
