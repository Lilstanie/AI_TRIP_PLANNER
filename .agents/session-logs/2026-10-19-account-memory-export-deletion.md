---
date: 2026-10-19
author: Codex
branch: feature/account-memory-export-deletion
pr: none
area: apps/web, docs
contract-impact: none
---

# Include account memory in export and deletion

## What changed

- Added route-handler/PGlite coverage for account-scoped memory export and deletion.
- Loaded generated migration `0002_adorable_namor.sql` in the existing account database fixture.
- Clarified account memory scope and deletion ordering in `docs/api.md`.

## Why

- Export and deletion already query `account_memories` on the requested integration branch; this issue adds repeatable evidence for ownership, sequencing and Clerk failure behavior.

## Validation

- `pnpm --filter @trip/web test -- tests/app/api/account/database.test.ts` — 4 tests passed.
- `pnpm --filter @trip/web db:generate` — no schema changes.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm exec prettier --check apps/web/tests/app/api/account/database.test.ts docs/api.md .agents/session-logs/2026-10-19-account-memory-export-deletion.md`, `git diff --check` — passed.
- `pnpm format:check-changed` — failed on inherited `apps/web/drizzle/meta/0002_snapshot.json` and `_journal.json`; direct Prettier checks for this change passed.

## Notes for the next person

- Shared contracts were not changed. Live Clerk and Neon behavior is outside the PGlite fixture.
