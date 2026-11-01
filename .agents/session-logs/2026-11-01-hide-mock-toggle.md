---
date: 2026-11-01
author: Claude Code (for Joey)
branch: fix/TP-226-hide-mock-toggle
pr: none
area: apps/web, docs
contract-impact: api
---

# Hide the Mock data / Live data switch on deployed builds (TP-226)

## What changed

- `apps/web/lib/auth/live-data.ts`: `dataModeSwitchable()` is true under `next dev` or with `DATA_MODE_TOGGLE=true`; otherwise `requestDataMode` ignores the `x-trip-data-mode` header.
- `/api/data-mode` returns `switchable`; `useDataMode` uses the configured mode and ignores the stored choice when it is false.
- The top-bar chip, phone Mine control and Settings "Trip data" row render only when switchable.
- The E2E runners (`local-cli.mjs`, `legacy-runner.mjs`) set `DATA_MODE_TOGGLE=true`, because they run production builds that drive the switch.
- `docs/api*.md`, `docs/development*.md` describe `switchable` and `DATA_MODE_TOGGLE`.

## Why

Joey: the switch is for local testing only. Ignoring the header server-side too stops a stale `trip.dataMode` in a browser from keeping a deployed site on fixtures.

## Validation

- `pnpm --filter @trip/web typecheck`, `lint`: pass. Vitest workspace, api and preferences suites: 146 passed.
- `next build` + `next start`: without the flag `/api/data-mode` says `switchable:false` and no `.data-mode` chip shows (with `trip.dataMode=live` stored); with `DATA_MODE_TOGGLE=true` the chip shows.

## Notes for the next person

A deployment without Clerk still downgrades live to mock (`auth-not-configured`); this change does not alter that.
