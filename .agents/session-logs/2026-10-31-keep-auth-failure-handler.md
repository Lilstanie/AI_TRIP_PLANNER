---
date: 2026-10-31
author: Claude Code (for Joey)
branch: fix/TP-214-keep-auth-handler
pr: pending
area: apps/web/components/map
contract-impact: none
---

# Keep the Google auth-failure handler for the whole page (TP-214)

## What changed

- `google-maps-sdk.ts` installs `gm_authFailure` once when the SDK loads and never restores the old
  callback; the rejection flag is set even when no map is subscribed.

## Why

The live Mac check after PR #860 left a trip within about a second of the map appearing (3/3): the
last subscriber left, the handler was restored, and Google's single rejection call was lost, so the
next map waited on Google instead of falling back to OSM.

## Validation

- `pnpm --filter web exec vitest run components/map` and `tsc --noEmit` in `apps/web`.

## Limitations

- The leave-early case is rechecked live on the Mac after merge, not by an automated test.
