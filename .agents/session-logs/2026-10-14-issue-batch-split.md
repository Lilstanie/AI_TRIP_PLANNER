---
date: 2026-10-14
author: Codex
branch: fix/issues-323-329
pr: 333
area: apps/web, packages/orchestrator, packages/services, packages/tools, docs
contract-impact: none
---

# Split account sync from the planner issue batch

## What changed

- Kept issues #323–329 in PR #333 and removed the #330 account-sync files.
- Regenerated translated documentation pair metadata and the pnpm lockfile.
- Added this log to record the approved PR boundary and fresh verification.

## Why

The standards review identified account synchronization as a separate ownership and review boundary from planning and provider behavior.

## Validation

- `pnpm test`: failed; 623 passed, 2 failed, including a calendar date-summary mismatch.
- `pnpm build`: passed.
- `pnpm typecheck`: passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`: passed.
- `pnpm format:check-changed origin/main`: passed.
- `pnpm --filter @trip/web e2e chinese-party-size`: passed desktop and phone; report in `apps/web/output/e2e/runner/`.
- `pnpm --filter @trip/web e2e budget-source-replacement`: passed; report in `apps/web/output/e2e/runner/`.

## Notes for the next person

Issue #330 is being handled in a separate PR. Browser E2Es use local fixtures; they do not verify live Clerk or Neon services.
