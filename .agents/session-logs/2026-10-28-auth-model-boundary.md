---
date: 2026-10-28
author: Codex
branch: fix/auth-model-boundary
pr: none
area: apps/web, docs
contract-impact: api
---

# Require authentication for deployed model access

## What changed

- Gate chat model calls and Agent Lab live runs with the existing deployment authentication boundary.
- Update the data-mode hint, bilingual API and development docs, and the model-access Agent Note.
- Add a provider-counting E2E fixture and failure inventory for anonymous and local access.

## Validation

- Model-boundary E2E against two local servers and a counting model stub: 8 checks passed.
- `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:scripts`: passed; script tests 70/70.
- `pnpm --filter @trip/web test`: 57 files and 645 tests passed; jsdom emitted canvas warnings.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected`, `pnpm verify:e2e-selectors`, and `pnpm verify:e2e-artifacts`: passed.
- `node .agents/skills/better-ui/scripts/check-ui-copy.mjs` and `git diff --check`: passed.
- Desktop and phone browser checks used a deployment without configured authentication.
- Initial lint invocations scanned generated build output; the project lint command passed after cleanup.

## Notes for the next person

- A real signed-in Clerk session and deployed configuration were not verified.
- Per-user daily quotas remain deferred by the owner; this does not complete that part of issue #440.
- Remaining requested issues are #534, #543, #605, and #697.
