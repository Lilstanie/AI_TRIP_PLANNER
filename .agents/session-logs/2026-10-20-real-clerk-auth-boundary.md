---
date: 2026-10-20
author: Codex
branch: test/real-clerk-auth-e2e
pr: none
area: apps/web, docs
contract-impact: api
---

# Return JSON for anonymous protected API requests

## What changed

- `apps/web/middleware.ts` returns uncached 401 JSON for protected API requests; browser pages retain the sign-in redirect.
- Added `apps/web/tests/e2e/real-clerk-auth.e2e.mjs` and its failure inventory, with genuine test sessions, database migration preflight and independent scoped cleanup.
- Updated both API/development documentation pairs and the exact E2E environment directive exception.

## Validation

- Base: PR #443 head `7ea92ecca7d5e6f6236f002ea8cbffe09e3a2b42`; Node 26.8.1, Chrome 155.0.8059.82, localhost:3197, Clerk test keys, real Neon storage, mock planning tools.
- `pnpm --filter @trip/web test`: 57 files, 642 tests passed; existing canvas warnings.
- `pnpm --filter @trip/web build`, `typecheck`, `lint`: passed; typecheck repeated after restoring incidental Next tsconfig changes.
- `node --check apps/web/tests/e2e/real-clerk-auth.e2e.mjs`: passed.
- `pnpm verify:docs`, `verify:protected`, `verify:e2e-artifacts`, `verify:e2e-selectors`: passed (78 E2E scripts).
- `pnpm verify:pairs`: initially failed after paragraph relocation separated a heading from its anchor; corrected, 27 pairs passed.
- Changed-file Prettier and scoped added-comment check: passed, zero unapproved comments.
- Before artifact run c8c71fc3-c381-4cb2-936d-43e56a98b112: anonymous export returned 307, expected 401 JSON.
- Real run f5d15760-1094-404a-a71c-f677d631e2d1: six anonymous API checks, anonymous live denial and two genuine Clerk sessions passed; account A sync returned 500 because revision columns are absent. Both accounts and scoped rows were cleaned.
- Final preflight run c3de891f-7842-43fc-a359-e9668c80feac: eight boundary checks passed; migration readiness failed before creating any users. Exit 1, not full acceptance.
- Earlier browser-load timeout run 13df039f-c20c-44b0-800a-9b2c4207242a failed cleanup; its exact-run test user was subsequently deleted and Clerk returned 200. Cleanup now attempts Clerk deletion independently of database cleanup.

## Notes for the next person

- Refs #441, not closed. Existing migration 0001 needs explicit authorization for the configured cloud database; no migration executed.
- Expired valid JWTs, missing-Clerk production boot, provider execution and #440 daily quotas remain unverified.
- Independent gpt-6-luna high review was unavailable due to usage limits; review remains incomplete.
- Re-run real acceptance after migration. Evidence: `apps/web/output/playwright/real-clerk-auth/`; preserve failures in the PR body before cleanup.
