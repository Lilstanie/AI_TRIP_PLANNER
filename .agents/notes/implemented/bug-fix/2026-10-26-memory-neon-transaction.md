# Agent Note: Use an interactive Neon session for account-memory writes

Status: implemented

## Problem

`rememberAccountPreference` uses an interactive transaction to insert a first-write placeholder,
lock the current account/category row, merge an accommodation patch in JavaScript and preserve the
immediately preceding value for undo. The shared database client uses `drizzle-orm/neon-http`, whose
`transaction` method rejects before entering that callback. PGlite-only database fixtures support
transactions and therefore cannot expose the production adapter mismatch.

## Decision

- `apps/web/lib/db/memory-transaction.ts` creates one installed Neon `Client` and wraps it with
  `drizzle-orm/neon-serverless` for each preference write. It connects and runs the existing
  interactive transaction, then ends the client in `finally`, including connection failures.
- A cleanup error cannot replace the primary operation error; when the operation succeeds, a cleanup
  failure remains visible to the caller. No client is cached across serverless requests.
- Other account operations retain the existing Neon HTTP client. The accommodation parser, row lock,
  account/category predicates and conditional undo-token checks retain their existing contracts.
- The driver E2E uses the installed Neon and Drizzle adapters, replacing only transport with
  in-process PGlite wire/HTTP responses. Original memory fixtures remain explicitly synthetic and
  continue to cover concurrent patches and undo races.

## Alternatives considered

- **Use HTTP interactive transactions.** The installed adapter rejects them; a batch cannot consume
  a query result inside a JavaScript callback.
- **Replace the merge with one SQL UPSERT.** This would duplicate JavaScript JSON/legacy parsing and
  risk changing malformed/scalar input semantics or requiring newer PostgreSQL JSON predicates.
- **Replace every account database operation with WebSockets.** Rejected because only memory writes
  require an interactive transaction and the wider lifecycle change would be unnecessary.

## Consequences

- Each preference write opens and closes one WebSocket-backed database session; it can run the
  existing row-lock transaction on the production adapter without a new dependency or migration.
- The application requires the repository's Node 22 minimum, where Neon supports native WebSocket.
- Transport-level tests establish local driver compatibility and cleanup, not remote Neon routing,
  real credentials or independent-session concurrency. Those still require separate acceptance.
- This narrows the adapter used by the existing
  [account-memory decision](../feature/2026-10-19-account-dietary-memory.md), without replacing its
  persistence, precedence or undo decisions.
