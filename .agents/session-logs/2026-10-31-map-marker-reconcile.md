---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-223-map-marker-rebuilds
pr: pending
area: apps/web/components/map
contract-impact: none
---

# Trip map updates only the pins that changed (TP-223)

## What changed

- The `TripMap` marker effect reconciles markers by place id and a signature of what the pin shows
  (stop number, day, position, name, type, locale). Unchanged pins stay; gone or changed ones are
  disposed; new ones are added. All pins are disposed when the renderer changes or the map unmounts.

## Why

A live Mac run with the expired Google key created 543 pins in one trip open before the key was
rejected: `useTripPlaces` builds a new itinerary each time a place lookup resolves, and the marker
effect removed and recreated every pin on each change.

## Validation

- `apps/web`: `tsc --noEmit`, `next lint`, component vitest (20 files, 182 tests) pass.
- `pnpm --filter @trip/web e2e trip-home-action-panels` passes (Google fixture with pins, key
  rejection and fallback). `trip-home-map` shows the same failures on this branch and on main in
  this container (fixture key rejected by live Google, home map control list), none about pins.

## Docs

- `docs/map-renderer-lifecycle(.zh).md`.
