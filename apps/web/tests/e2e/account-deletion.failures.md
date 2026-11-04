# Account deletion and sync limits failure inventory

- A sync that reaches the database between two delete statements re-inserts a trip or chat, so rows
  outlive the account while `DELETE /api/account` still answers `ok`.
- A sync transaction that started before the delete commits after it, because the delete does not wait
  for writes already in flight.
- A settings save or a remembered preference re-creates a row after the account data was deleted.
- One failing delete statement leaves some tables emptied and others intact, and the route answers an
  unhandled 500 with no notice.
- A failed delete leaves its tombstone behind, so the still-existing account can no longer sync.
- A failed Clerk deletion clears the tombstone, so a lagging tab writes rows for an account whose data
  was already removed.
- A retried delete after a Clerk failure is refused because the tombstone already exists.
- The deletion lock is taken per database, not per account, so one account's sync blocks another's.
- An oversized sync body is buffered by `request.json()` before any limit applies.
- A sync body without `Content-Length`, or with a non-numeric one, skips the size check.
- The client sends every pending change in one body, so a large catalog can never fit the limit.
- A single record that passes the per-record limit cannot fit any body the server accepts.
- Records in one push are committed one by one, so a failure part-way through leaves a partial push.
- A test replaces PostgreSQL with a single-session engine and therefore cannot show lock waits.

Run `LABEL=<unique-attempt> node apps/web/tests/e2e/account-deletion.e2e.mjs`; it needs PostgreSQL
server binaries (`initdb`, `postgres`) on `PATH` or under `/usr/lib/postgresql/*/bin`, and writes
`output/e2e/account-deletion/<unique-attempt>/summary.json`.
