---
date: 2026-10-19
author: Codex
branch: feature/long-term-memory-integration
pr: none
area: apps/web, docs
contract-impact: api
---

# List and delete account long-term memories in Settings

## What changed

- Added account-scoped `GET` and `DELETE /api/account/memory` routes and a delete operation for one category.
- Added the localized memory list and per-category delete action to Settings.
- Extended the browser journey and API/workspace documentation in English and Chinese.

## Why

Deleting a remembered preference must remove it from the next plan while leaving other account memories intact.

## Validation

- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' BASE_URL=http://localhost:3100 node apps/web/tests/e2e/long-term-memory.e2e.mjs` — passed; browser `155.0.8059.82`; trace and JSON at `apps/web/output/playwright/long-term-memory/`.
- The first browser run failed because the test expected a radio input; Settings renders language choices as buttons. Updated the locator and reran successfully.
- `pnpm --filter @trip/web test` — 57 files, 632 tests passed.
- `pnpm --filter @trip/web lint`, `pnpm --filter @trip/web build`, and `pnpm --filter @trip/web typecheck` — passed.
- `pnpm verify:pairs`, `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm verify:e2e-artifacts`, and `pnpm format:check-changed origin/main` — passed.
- An initial build exposed a duplicate Chinese translation key; removed the duplicate before the passing build.

## Notes for the next person

The browser journey uses a PGlite/Playwright API fixture; it does not exercise a live Clerk session or Neon database.
