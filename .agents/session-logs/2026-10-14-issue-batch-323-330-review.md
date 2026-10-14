---
date: 2026-10-14
author: Codex
branch: fix/local-e2e-auto-cleanup
pr: none
area: apps/web, packages/orchestrator, packages/services, packages/tools, docs
contract-impact: api
---

# Close review findings for issues 323–330

## What changed

- `apps/web/components/account/SettingsProvider.tsx`: migrate first-account browser preferences and retain pending settings per account during identity switches.
- `apps/web/lib/account/revision-store.ts` and account routes: share revision compare-and-set persistence; rename synced-time state to sync checkpoints.
- `apps/web/tests/e2e/account-revisions.e2e.mjs`: verify account-scoped settings through switch, rejected writes and return.
- `packages/orchestrator`: surface a specific stay-search failure and verify Chinese party counts in offline chat output.
- `packages/tools` and `packages/services`: cover local-date weather boundaries, truthful toll evidence and large durable payloads with bounded chat history.
- `docs/`, implemented Agent Note and translation-pair index: record the revised account behavior.

## Why

Review identified that first sign-in could discard browser preferences and switching identities could transfer pending settings. Local preferences now migrate only when no prior account checkpoint exists; pending edits stay attached to their account.

## Validation

- `pnpm test` — passed; all 6 workspace tasks succeeded.
- `pnpm typecheck` — passed across all 6 workspace tasks.
- `pnpm build` — passed before the final review-only hardening; latest changes pass typecheck and full tests.
- `node apps/web/tests/e2e/account-revisions.e2e.mjs` — passed desktop and phone scenarios.
- `pnpm verify:pairs --record docs/api.md`, `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors` — passed.
- `git diff --check` — passed before this log was added.

## Notes for the next person

Live Clerk/Neon and physical devices were not tested. No PR was opened and no changes were pushed.
