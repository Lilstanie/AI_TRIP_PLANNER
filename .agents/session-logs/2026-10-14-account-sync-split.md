---
date: 2026-10-14
author: Codex
branch: fix/account-sync-revisions
pr: none
area: apps/web, docs
contract-impact: none
---

# Split account revision sync into its own change

## What changed

- Isolated server revision checks, account sync routes, client sync behavior, and migration for issue #330.
- Kept account API documentation, revision decision note, tests, and E2E fixture with the account change.
- Added this log for the separate review boundary.

## Why

Account sync has a distinct persistence and conflict-resolution boundary from planner and provider changes.

## Validation

- Focused account API and sync tests: 4 files, 6 tests passed.
- Full web Vitest rerun with JSON reporter: 628 passed, 0 failed.
- `pnpm build` and `pnpm typecheck`: passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`: passed.
- `pnpm format:check-changed origin/main` and changed TypeScript ESLint: passed.
- `pnpm --filter @trip/web e2e account-revisions`: desktop and phone passed; artifacts are in `apps/web/output/playwright/account-revisions`.

## Notes for the next person

The first full `pnpm test` invocation exited with 3 failures; the complete web-suite rerun passed. The browser E2E uses local fixtures and does not verify live Clerk or Neon services.
