# Agent Note: account deletion takes a per-account lock and keeps a tombstone

Status: implemented

## Problem

`DELETE /api/account` removed settings, trips, chats and memories in four autocommit statements, then
deleted the Clerk user. A `POST /api/account/sync` with revision `0` from another tab could land
between those statements, or commit after them, and re-insert rows for a deleted user while the
delete still answered `ok`. A failure in one statement left the other tables half-emptied and
surfaced as an unhandled 500. Separately, sync bodies had no size limit: `request.json()` buffered up
to 500 trips and 500 chats of 2,000,000 characters each before validation.

## Decision

- `deleteAccountData` (`apps/web/lib/account/deletion.ts`) runs one WebSocket transaction through
  `withMemoryTransaction`: it takes `pg_advisory_xact_lock(hashtextextended(userId, 0))`, inserts an
  `account_deletions` row and deletes the four tables. A failure rolls everything back; the route
  answers 500 with the fixed `yourAccountCouldNotBe` notice.
- Every account write that can create rows (sync push, settings `PUT`, remembered preferences) runs
  through `withAccountWrite`, which takes the shared form of the same lock and refuses the write when
  the tombstone exists. A write in flight therefore finishes before the delete, which then removes its
  rows; a write that arrives during the delete waits and then sees the committed tombstone.
- The tombstone is kept after Clerk deletes the user. A lagging tab with a still-valid session, or a
  write after a Clerk failure, cannot recreate rows, and a retried delete still succeeds.
- `writeRecords` and `writeSettings` take an `AccountTransaction`, a branded type only
  `withAccountWrite` produces, so a write that skips the lock and tombstone check does not compile.
- A sync push is one transaction and its new records are one `INSERT`. The route rejects a missing or
  non-numeric `Content-Length` with 411 and one above `MAX_SYNC_BODY_BYTES` (6,200,000) with 413
  before reading the body. That limit fits one record at the 2,000,000-character record limit even at
  three UTF-8 bytes per character; the client splits pushes with `syncBatches`.
- `withMemoryTransaction` consumes the client's `error` event and does not call `end()` on a client
  whose connection already ended: the Neon driver otherwise crashes the process on a dropped
  connection, and its `end()` never settles afterwards.

## Alternatives considered

- **Check the tombstone in a single conditional `INSERT … WHERE NOT EXISTS`.** Under read committed
  the check cannot see an uncommitted tombstone, and an insert committed after the delete's statement
  survives, so it does not close the race without a lock.
- **Delete the tombstone once Clerk succeeds.** Clerk ids are not reused, so keeping the row costs one
  small row per deleted account and also blocks requests that were already authenticated.
- **Lower the per-record limit to fit a smaller body.** Records already stored at the current limit
  would then fail the client's pull validation.

## Consequences

- Deploying needs migration `0003_account_deletions.sql`; Vercel production builds apply it.
- Advisory-lock keys are 64-bit hashes; a collision only makes two accounts wait for each other.
- Vercel caps request bodies below `MAX_SYNC_BODY_BYTES`, so on Vercel the platform rejects the
  largest bodies first.
- `apps/web/tests/e2e/account-deletion.e2e.mjs` runs the routes against a real local PostgreSQL
  behind the installed Neon drivers and checks both race orders, the failure paths and the limits.
