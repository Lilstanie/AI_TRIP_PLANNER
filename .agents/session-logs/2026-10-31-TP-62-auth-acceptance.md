---
date: 2026-10-31
author: Weihao Wang (WhW0591), assisted by Codex
branch: test/TP-62-auth-acceptance
pr: none
area: apps/web/tests, docs
contract-impact: none
---

# TP-62 authentication acceptance profiles

## What changed

- Repair the refusal predicate for the current `signInToUseYour` notice contract; the existing CLI fixture fails before the repair and passes afterward.
- Extend the kept real-Clerk journey with one accepted, frozen bearer token, natural expiry, cookie isolation and uncached refusal, without refreshing or revoking that token.
- Add direct credential-free profiles to that journey: local production without Clerk, and GET-only deployed checks. Share the explicit API public allowlist.
- Update the failure inventory and English/Chinese development instructions. Runtime application code and policy are unchanged.

## Why

The implemented model-access decision permits anonymous fixture use and defers daily quotas. Acceptance follows that policy, rather than making the public workspace inaccessible to satisfy superseded issue wording.

## Validation

- Base: team main `f3efbab592c40789bb5b476c7e3cc29dc41d4e6b`; isolated worktree. Node 24.20.0, pnpm 9.15.0.
- `LABEL=notice-red node apps/web/tests/cli-e2e/real-clerk-route-inventory.e2e.mjs`: exit 1 at the current notice key; `LABEL=notice-green` passed four named checks after repair.
- Production build with absent Clerk/database keys passed. Existing React Hook warnings remain.
- `--without-clerk` on the owned production server: 16/16 checks, including all nine protected methods returning 503, fixture planning, live Lab refusal and zero model calls. Local development positive control reached the same counting model stub seven times.
- `--deployment` against the public project URL: 8/8 checks; GET only, no credentials or writes. Hosted source revision is not independently established.
- Local HTTP failure control returns 200 for a protected GET: the deployment profile exits 1 at that boundary, as required.
- An earlier local-production attempt expected `/trips` to exist without middleware and failed on 404. The app has no such page; the final profile checks this redirect only with Clerk configured. Earlier failure is retained, not counted as a product regression.
- `pnpm test`: six packages, 137 files / 1,504 tests passed, zero cache hits. Existing jsdom canvas diagnostics remain nonfatal.
- `pnpm test:scripts`: 79 passed, zero skipped. Web typecheck/lint, docs, 34 translation pairs, protected rules, E2E selectors/artifacts and file-length checks passed.

## Notes for the next person

- No real Clerk/Neon credentials are present in this workspace or its environment. Genuine-session and natural-expiry checks are prepared but have not run; TP-62 stays In Progress.
- The genuine journey creates two unique Clerk test users and account-scoped rows, then deletes those resources. Obtain the user's specified test configuration and approval for those writes; do not migrate a database or use production Clerk keys.
- No new push, PR, merge, real-account operation or cloud write is authorized by the previous #802 publication approval.
- Session evidence is retained locally under `output/tp62-acceptance/` until delivery; do not describe this log as a successful real-session acceptance.
