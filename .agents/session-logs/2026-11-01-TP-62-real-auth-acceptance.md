---
date: 2026-11-01
author: Weihao Wang (WhW0591), assisted by Codex
branch: test/TP-62-auth-acceptance
pr: none
area: apps/web/tests, docs
contract-impact: none
---

# TP-62 real-session and expiry acceptance

## What changed

- Retain the earlier eight-file acceptance patch and integrate team main `328d26d3` locally without conflicts; no application runtime change is added by this patch.
- Document the local Clerk server's `localhost` bind requirement beside its acceptance command.
- Record genuine-session acceptance using an independently provisioned Clerk development instance and temporary Neon database, without team credentials or paid-provider calls.

## Validation

- Tested integration head `040a936af81253a83065aabfedc74bd4eb047dc2`, tree `1e2ca73648928b41f45141c89170dfaa6a5a17e2`. Subsequent edits add only this log and the bilingual startup instruction.
- User approved creating/cleaning two temporary accounts and explicitly approved existing migrations 0000–0002 only on the newly provisioned empty test database. Read-back: four application tables, three migration records and three revision columns; no team database accessed.
- `BASE_URL=http://localhost:<owned-port> CHANNEL=chrome LABEL=real-localhost-20261101 node apps/web/tests/e2e/real-clerk-auth.e2e.mjs`: 24/24 passed, exit 0, run `8cd9a397-3f27-43d3-add3-335478c84fb6`.
- Covered all nine anonymous protected methods, browser redirect, anonymous live denial, two genuine logins, a frozen token accepted before natural expiry and refused afterward, cross-account read/write/export isolation, forged ownership, tampered credentials and sign-out. No mocked Clerk auth.
- Both temporary users and their scoped records were removed. Independent API/SQL audit afterward: zero Clerk users and zero rows in conversations, trips, user_settings and account_memories.
- First invocation bound to 127.0.0.1 while using a localhost URL: Clerk/Next's development rewrite proxied back to its own listener and failed readiness, zero assertions/users. Matching the bind to localhost resolved it without a timeout increase or application change; failure receipt remains retained.
- On the integration: production build passed; `--without-clerk` passed 16 checks, including fixture planning, all protected methods returning 503 and zero model calls. Local development reached the same counting model stub seven times.
- `--deployment` passed eight anonymous GET-only checks against the public project URL. It does not establish hosted source SHA, signed-in deployment behavior or hosted non-GET coverage.
- `pnpm test`: six packages, 137 files / 1,504 tests passed, zero cache hits. Existing nonfatal jsdom canvas diagnostics remain. The credential-free route fixture passed four named checks.
- Node 24.20.0 / pnpm 9.15.0 / Next 15.5.25 / Chrome channel. No credential, session token, storage state or private provisioning response is committed.

## Notes for the next person

- Runtime/test evidence is retained outside the worktree in `output/TP-62-real-acceptance-20261101/`; private configuration and raw service logs remain in a mode-0700 temporary directory, not in the repository.
- Anonymous mock access and deferred daily quotas follow the implemented model-access decision. This does not claim per-user quota enforcement.
- The new test schema is restricted to the user's independently provisioned temporary project; it is not a team deployment migration.
- No push, new PR or merge is authorized yet. Keep Jira In Progress until the new patch is delivered and its required review/acceptance is complete.
