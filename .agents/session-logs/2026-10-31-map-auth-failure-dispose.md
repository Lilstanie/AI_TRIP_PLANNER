---
date: 2026-10-31
author: Claude Code
branch: fix/TP-177-map-auth-failure-dispose
pr: none
area: apps/web
contract-impact: none
---

# Stop the map crashing the workspace after Google rejects the key

## What changed

- `apps/web/components/map/map-renderer.ts`: `listen()` keeps no handle when the SDK returns none, so
  `dispose()` no longer throws; `google-maps-sdk.ts` types `addListener` as possibly `undefined`.
- `google-renderer-fixture.mjs`: after `fail()`, `addListener` returns `undefined` like the real SDK.
- `trip-home-action-panels.e2e.mjs`: rejects the key, then leaves and reopens Trip home twice.
- `docs/map-renderer-lifecycle.md` and its `.zh.md` pair.

## Why

A real run with an expired browser key white-screened the app on switching trips:
`Cannot read properties of undefined (reading 'remove')` in `dispose`. A headless Chromium page with
an invalid key showed `map.addListener` returns an object before `gm_authFailure` and `undefined`
after it, while `event.addListenerOnce` still returns an object.

## Validation

- `pnpm --filter @trip/web e2e trip-home-action-panels` (dev server, mock data, browser key set to a
  fixture value, SDK script routed to the fixture): before the fix 35 pass, 1 fail with the same
  TypeError twice; after the fix 36 pass, exit 0.

## Notes for the next person

There is still no error boundary around the map, so another map exception would take down the page.
