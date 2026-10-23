---
date: 2026-10-19
author: Codex
branch: feature/long-term-memory-tracer
pr: none
area: apps/web, packages/shared, docs
contract-impact: packages/shared
---

# Persist explicit dietary preferences as account memory

## What changed

- Added `account_memories`, generated migration, account-scoped read/write/undo, and account export/deletion support.
- Bound chat identity to Clerk server auth, exposed localized Remembered/Updated notices and undo, and carried the additive response field through workspace state.
- Added a deterministic dietary-recognition E2E and updated API, architecture, development, service docs and Agent Notes.

## Why

- Only explicit dietary phrases become account facts; trip-only details stay in the trip plan, and Agent Lab keeps its fixed inputs.
- Undo tokens are account-scoped and restore the previous value after a replacement.

## Validation

- `pnpm --filter @trip/web test`: 57 files, 632 tests passed.
- `pnpm --filter @trip/web build`, `pnpm --filter @trip/web typecheck`, `pnpm --filter @trip/web lint`: passed.
- `pnpm --filter @trip/shared test`: 58 tests passed; `pnpm typecheck`: passed.
- `pnpm --filter @trip/web db:generate`: no schema changes after migration generation.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, `pnpm format:check-changed`, `git diff --check`: passed.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node apps/web/tests/e2e/legacy-runner.mjs long-term-memory`: passed; screenshots and browser trace retained under `apps/web/output/playwright/long-term-memory/`.
- `CHANNEL=chrome node apps/web/tests/e2e/legacy-runner.mjs agent-lab-benchmarks`: 3 assertions failed in this unchanged suite (two Paris minimum-amount text checks and one 404 console check); saved chats, trips and preferences remained untouched.
- Direct Playwright invocation without the Chrome override failed because the pinned Chromium headless shell is unavailable in this host cache; rerunning with installed Chrome passed.

## Notes for the next person

- Browser E2E uses a PGlite database loaded from the generated migration and Playwright API fixtures; it does not exercise live Clerk or Neon. Review server-side auth and Neon behavior before deployment.
