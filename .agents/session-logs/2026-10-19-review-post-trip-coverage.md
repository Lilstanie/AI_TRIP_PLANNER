---
date: 2026-10-19
author: Codex
branch: fix/restore-trip-day-view
pr: 450
area: apps/web
contract-impact: none
---

# Cover trip-day defaults after the trip ends

## What changed

- Added post-trip boundary checks to `apps/web/tests/e2e/on-trip-day.e2e.mjs`.
- Confirmed Today is absent, Day 1 remains selected, and budget and tips remain expanded after the trip.

## Why

The spec review identified that the existing E2E covered dates before the trip but did not verify dates after it.

## Validation

- `CHANNEL=chrome pnpm --filter @trip/web e2e on-trip-day` — passed, 24 checks, no browser errors.
- `pnpm exec prettier --check apps/web/tests/e2e/on-trip-day.e2e.mjs` — passed.
- `git diff --check` — passed.

## Notes for the next person

None.
