---
date: 2026-10-23
author: Claude Code
branch: fix/liquid-glass-e2e
pr: none
area: apps/web/tests, .agents/skills
contract-impact: none
---

# liquid-glass E2E skips what its environment cannot show

## What changed

- `apps/web/tests/e2e/liquid-glass.e2e.mjs`:
  - When the map reports a tile failure, the desktop map check logs a `skip` line with the map's
    message instead of clicking controls under the failure overlay.
  - When the satellite button is disabled, the check asserts that no Google Maps key is set and skips
    the toggle.
  - After `goto`, the check hides the `nextjs-portal` dev badge, which swallowed the phone tab bar's
    clicks.
- `.agents/skills/e2e-maintenance/SKILL.md`: two more traps, the dev badge and the container's
  missing tile access.

## Why

This is retro item 2 from 2026-10-22, which Joey approved. On `origin/main` the script timed out
locally on a disabled "Satellite view" button. `TripMap` disables satellite for the OSM provider.
After that, the next failure was the tile-failure overlay: `curl` to `tiles.openfreemap.org` returns
000 from this container. The final failure was the dev badge covering the phone "Chat" tab. None of
these is a product regression, so each run had to compare against main to tell.

## Validation

- `pnpm --filter @trip/web e2e liquid-glass`: before, `FAIL` on the disabled Satellite button
  (timeout); after, `ok`, with 20 checks passing and a `skip` line for `map-light` and `map-dark`.
