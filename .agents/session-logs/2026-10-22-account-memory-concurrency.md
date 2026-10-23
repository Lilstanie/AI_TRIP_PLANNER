---
date: 2026-10-22
author: Codex
branch: feature/account-memory-integration
pr: 508
area: apps/web, .agents/notes
contract-impact: none
---

# Serialize account preference writes and preserve merged state

## What changed

- `apps/web/lib/account/memory.ts` serializes writes per account/category and records undo against the latest committed row.
- `apps/web/tests/e2e/accommodation-memory.e2e.mjs` covers concurrent partial patches and latest-write undo through production memory code.
- Updated the account memory decision note and failure inventory with the concurrency invariant and red evidence.

## Why

Two concurrent accommodation patches could both read the same value, causing the later upsert to erase the earlier patch and save a stale undo baseline.

## Validation

- `pnpm --filter @trip/web e2e accommodation-memory`: passed; browser 141.0.7390.37, PGlite fixture, final runner `2026-10-22T03-25-51-823Z.json`. Before the fix, the same assertion failed at `2026-10-22T03-11-14-661Z.json`.
- `pnpm --filter @trip/web e2e long-term-memory`: passed; final runner `2026-10-22T03-23-04-188Z.json`.
- `pnpm --filter @trip/web test`: 57 files and 645 tests passed.
- `pnpm --filter @trip/web lint`: passed; `pnpm --filter @trip/web build`: passed; `pnpm --filter @trip/web typecheck`: passed.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, and `pnpm format:check-changed origin/main`: passed after formatting the E2E script.
- Local fixtures do not establish deployed Clerk, database, model or provider behavior. No external database migration was applied.

## Notes for the next person

- The branch still has merge conflicts in three agent files and `packages/orchestrator/src/workflow.ts` against `origin/main` at `1e4d7cb`; coordinate those overlapping changes before merge.
