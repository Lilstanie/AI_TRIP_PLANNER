# Agent Note: Account sync acknowledges server revisions rather than device clocks

Status: implemented

## Problem

Issue [#330](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/330) shows that client clock skew can
silently replace a later edit, while an ignored write is reported as successful. This partly supersedes
the timestamp-ordering choice in [accounts and settings](../architecture/2026-09-27-accounts-settings-sync.md);
its Clerk identity, optional Neon storage and local working-store boundaries remain in force.

## Decision

Trips, conversations, tombstones and settings use a server-owned integer revision. Creation requires
revision zero; an update or deletion must match the current revision atomically in SQL and increments
it on acceptance. The sync API returns accepted and conflicting submissions separately; settings
return 409 for conflicts. Client `updatedAt` stays metadata. The API formats are owned by
[the API reference](../../../../docs/api.md#account-routes).

The browser keeps revision plus normalized content checkpoints. Pull adopts a remote record only
when the local copy matches its acknowledged base or the remote content. Unacknowledged content
stays local and pending. Acknowledgements apply only to accepted submissions, and client pushes are
serialized so edits made during a pending save use the next acknowledged revision. Settings keep a
per-user checkpoint and serialize their read/write cycle. On a first account with no other account
checkpoint, existing browser settings migrate with revision zero. When switching accounts, pending
settings are saved under the previous identity and restored if that identity returns; the new account
adopts its own settings or defaults and never receives the previous account's local copy. Sign-out retains local data.

Deploy generated migration `0001_ambitious_micromacro.sql` before these routes: existing rows,
including tombstones, start at revision one. Legacy timestamp checkpoints cannot establish a revision
baseline and are discarded without deleting their catalog. Identical local/server contents can adopt
revision one; differing contents remain a conflict. Old clients without a revision receive 400 and
must reload. Neither timestamps nor a retry automatically resolve a conflict. Preserve/export the
pending local copy before explicitly reconciling it with the server copy; there is no merge UI here.

## Alternatives considered

Keep accepting device-clock skew: rejected during triage because it silently loses edits. Last-server-arrival
wins still silently replaces concurrent offline work. Field-level merging or CRDTs are outside this
single-user whole-record change and were not implemented.

## Consequences

The API changes require coordinated deployment and a client reload. A migrated device with divergent
unacknowledged content needs explicit reconciliation. Rejected edits remain recoverable through
browser reload, and user-scoped SQL prevents records from crossing account boundaries.

Repeatable evidence uses production route handlers and generated migrations on PGlite with fixture
Clerk sessions (`tests/app/api/account/database.test.ts`), plus the production React clients in a
real browser (`node apps/web/tests/e2e/account-revisions.e2e.mjs`). The latter retains HTTP traces and
screenshots under `apps/web/output/playwright/account-revisions/`. These checks do not establish live
Clerk authentication, deployed Neon migration or physical-device behavior.
