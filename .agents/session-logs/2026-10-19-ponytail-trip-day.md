---
date: 2026-10-19
author: Codex
branch: fix/restore-trip-day-view
pr: 450
area: apps/web
contract-impact: none
---

# Restore a safe day after a trip ends

## What changed

- Reset an expired trip to Day 1 when restoring an on-trip manual day.
- Added a browser regression check for the expired-trip case.
- Removed the duplicate day clamp; the existing state effect owns valid-day bounds.

## Why

A saved day from an active trip should not be treated as a manual selection after the trip dates expire.

## Validation

- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed.
- `DATA_MODE=mock CHANNEL=chrome pnpm --filter @trip/web e2e on-trip-day` — passed with the expired-trip regression check.

## Notes for the next person

The browser runner artifact is under `output/e2e/runner/`.
