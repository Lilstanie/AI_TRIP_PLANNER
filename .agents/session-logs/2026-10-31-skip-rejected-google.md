---
date: 2026-10-31
author: Claude Code
branch: fix/TP-212-skip-rejected-google
pr: none
area: apps/web
contract-impact: none
---

# A map mounted after Google rejected the key skips Google

## What changed

- `apps/web/components/map/map-renderer.ts`: `loadRenderer` does not create a Google map once
  `googleAuthRejected()` is true; it mounts OSM, or throws the map-unavailable notice in strict
  Google mode.
- `docs/map-renderer-lifecycle(.zh).md`.

## Why

In the live check on main e5ba5796 with an expired browser key, every reopened map created a Google
map on the rejected SDK, which threw an uncaught IntersectionObserver `observe` error from `create`
before the auth-failure callback moved it to OSM.

## Validation

- `apps/web` tsc and vitest (map and lib, 409) passed; `trip-home-action-panels` E2E passed with
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set to a synthetic value. No new tests.

## Limitations

- The fixture does not reproduce the real SDK's IntersectionObserver error; the real-key check runs
  on the Mac.
