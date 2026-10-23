---
date: 2026-10-22
author: Codex
branch: test/real-clerk-auth-e2e
pr: 465
area: apps/web, docs
contract-impact: api
---

# Real account acceptance after the authorized revision migration

## What changed

- Integrated main `1e4d7cb1` without conflicts; production/test head `53ff477e`, tree `155e672cccde1594e185e86535880848b9fdb7e7`.
- With explicit user authorization, applied existing `0001_ambitious_micromacro.sql` through the Drizzle migrator after verifying migration 0000's recorded hash.
- Verified all three revision columns are non-null integers defaulting to 1 and journal entry 0001 is recorded. No migration source changed.

## Validation

- `pnpm install --frozen-lockfile --offline`: exit 0.
- Real Clerk E2E on prior head `a134ac16`: 18/18 checks; both temporary accounts and scoped rows removed, run `564e5fc5-68ff-4d85-839e-4ceba4ad00ec`.
- First integrated run timed out before the development server became ready: zero checks/users, run `2cda4d81-e84e-4704-84a3-c9ed59f3cabf`. This is not passing evidence.
- After an HTTP readiness check, `BASE_URL=http://localhost:3197 LABEL=2026-10-22-integrated-ready node apps/web/tests/e2e/real-clerk-auth.e2e.mjs`: 18/18 checks; both accounts and scoped rows removed. Summary retained under `apps/web/output/playwright/real-clerk-auth/` until quoted in the PR.
- `NEXT_TSCONFIG_PATH=tsconfig.real-clerk-20261022.json NEXT_DIST_DIR=.next-real-clerk-build-20261022 pnpm --filter @trip/web build`: exit 0; temporary config isolates generated types.
- Integrated `pnpm --filter @trip/web test`: 57 files / 642 tests passed; existing jsdom canvas diagnostics remain nonfatal.
- Integrated web `typecheck`, `lint`, `verify:docs`, `verify:protected`, `verify:pairs` (28), `verify:e2e-artifacts` (99), `verify:e2e-selectors`, changed formatting and scoped added-comment checks: exit 0.
- Independent gpt-6-luna high static review of the integrated delta: no actionable introduced defects; reviewer did not run acceptance.

## Notes for the next person

- Node 26.8.1, pnpm 9.15.0, Chrome 155.0.8059.85, Next 15.5.25; localhost with Clerk test credentials and real Neon storage. No provider/model calls or production Clerk keys.
- Expired valid JWTs, missing-Clerk production boot and daily quotas (#440) remain outside this suite; #441 is not closed by these checks.
- Retro: existing migration preflight and independent cleanup exposed the schema blocker before provisioning users. Development docs require an already running server; pre-push guidance requires final-tree evidence. No duplicate workflow was added.
- The only change after the tested production/test tree is this evidence log. Preserve the pre-existing `.next-real-clerk-auth/` directory; remove only this run's owned configs/output.
