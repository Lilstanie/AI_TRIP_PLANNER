---
date: 2026-10-21
author: Codex
branch: fix/restore-trip-day-merge-audit
pr: 450
area: apps/web, docs
contract-impact: none
---

# Restore the default day before a trip after reload

## What changed

- A saved manual day now returns to Day 1 when the trip has not started.
- Added a browser reload regression and integrated the change with current `origin/main`.
- Updated paired workspace UI docs; prior dated logs remain unchanged.

## Why

Before the trip, selecting Day 2 and reloading incorrectly retained that selection instead of the existing Day 1 default.

## Validation

- Pre-fix reproduction failed the new before-trip reload assertion: `output/e2e/runner/2026-10-20T12-32-47-438Z.json`.
- `CHANNEL=chrome DATA_MODE=mock RUN_ID=pr450-final-20261021 E2E_SCRIPT_TIMEOUT_MS=90000 pnpm --filter @trip/web e2e on-trip-day` — passed, 24 checks, no browser errors; `output/e2e/runner/2026-10-21T00-46-03-412Z.json` and `output/playwright/on-trip-day/pr450-final-20261021/on-trip-sydney-boundary.png`.
- `pnpm --filter @trip/web test` — 57 files, 642 tests passed; existing jsdom canvas warnings were emitted.
- `pnpm --filter @trip/web typecheck` and `pnpm --filter @trip/web lint` — passed.
- Docs, pairs, protected files, E2E artifact and selector guards, changed-file formatting, scoped comment policy, and `git diff --check` — passed before this log was added; final-tree rerun pending.

## Notes for the next person

- Browser evidence uses seeded mock trips and simulated destination-local time; it does not verify live providers, authentication, or a physical device.
- Timed next-stop highlighting from issue #409 remains deferred and is documented as such.
