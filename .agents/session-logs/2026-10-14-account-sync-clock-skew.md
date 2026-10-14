---
date: 2026-10-14
author: Codex
branch: fix/account-sync-clock-skew
pr: none
area: apps/web
contract-impact: none
---

# Keep later local edits after a fast-clock sync conflict

## What changed

- Extend `account-revisions.e2e.mjs` to inject a remote 2099 edit and assert a stale local edit remains pending after pull, reload and retry.
- Rename the fixture action to describe the later real-time edit.
- Retain browser traces and desktop/mobile screenshots under `apps/web/output/playwright/account-revisions/`.

## Why

The integration tip already contains revision-based API, database migration and browser sync behavior. This adds direct browser persistence evidence for the issue's fast-clock loss scenario; the existing Agent Note and API documentation already describe the decision and migration.

## Validation

- `node tests/e2e/account-revisions.e2e.mjs` — passed desktop and phone viewports; generated HTTP trace and screenshots.
- `NODE_OPTIONS=--no-experimental-webstorage pnpm --filter @trip/web exec vitest run tests/app/api/account/database.test.ts` — 1 file, 1 test passed.
- `pnpm --filter @trip/web test` — 57 files, 631 tests passed.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed with no ESLint warnings or errors.
- Prettier check and `git diff --check` — passed.

## Notes for the next person

No production code or API contract changed. Test fixtures simulate identity and HTTP persistence; this does not verify live Clerk or Neon.
