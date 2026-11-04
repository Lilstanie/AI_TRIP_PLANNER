---
date: 2026-11-04
author: Claude Code
branch: fix/account-deletion-race
pr: none
area: apps/web, docs
contract-impact: api
---

# Account deletion is one locked transaction with a tombstone; sync bodies are size-limited

## What changed

- `apps/web/lib/account/deletion.ts`: `deleteAccountData` and `withAccountWrite`, an advisory lock per
  account plus the `account_deletions` tombstone (migration `0003`). Sync, settings `PUT` and
  remembered preferences write through it; `DELETE /api/account` maps failures to a fixed 500 notice.
- `apps/web/app/api/account/sync/route.ts`: 411/413 by `Content-Length` before reading; one
  transaction per push, 410 once deleted, 500 on database failure. `syncBatches` splits client pushes.
- `apps/web/lib/db/memory-transaction.ts`: consumes the client `error` event and skips `end()` after a
  dropped connection (it crashed the process, then hung).
- New E2E `apps/web/tests/e2e/account-deletion.e2e.mjs` with its failure list; `docs/api*.md`,
  `docs/development*.md`, `docs/e2e-known-failures*.md`, and an Agent Note.

## Why

See [the Agent Note](../notes/implemented/bug-fix/2026-11-04-account-deletion-tombstone.md).

## Validation

- `LABEL=before node apps/web/tests/e2e/account-deletion.e2e.mjs` on the unchanged routes: 17 failures,
  including rows left after both race orders and an unhandled throw on a failed delete statement.
- Same script, `LABEL=final`: 36 checks passed, 15 of 15 sockets closed.
- `node apps/web/tests/e2e/neon-memory-driver.e2e.mjs`: passed.
- `pnpm --filter @trip/web test`, `typecheck`, `lint`: passed.
- `pnpm verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-artifacts`,
  `verify:e2e-selectors`, `scripts/check-file-length.mjs`, `check-ui-copy.mjs`: passed.
- `accommodation-memory.e2e.mjs` fails with the same `after()` error on `main` and on the branch;
  `long-term-memory.e2e.mjs` was not run against a server.

## Notes for the next person

- The new E2E needs local PostgreSQL server binaries and is not in CI.
- Updates inside a push still run one statement per record, within the transaction.
