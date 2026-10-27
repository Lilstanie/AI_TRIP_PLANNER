---
date: 2026-10-28
author: Codex
branch: fix/auth-model-boundary
pr: 741
area: apps/web, docs
contract-impact: none
---

# Protect live model access on production servers

## What changed

- Apply the authentication boundary to non-Vercel production servers.
- Update API and development documentation and the anonymous model browser scenario.

## Validation

- `pnpm --filter @trip/web build`: passed.
- `PRODUCTION_BASE_URL=http://127.0.0.1:3221 node apps/web/tests/e2e/anonymous-model-boundary.e2e.mjs`: 10 checks passed with local servers and a counting provider.
- `PATH=/Users/joey/.nvm/versions/node/v24.18.0/bin:$PATH pnpm --filter @trip/web test`: 645 passed.
- Typecheck, lint, docs and protected-file checks passed before this log.

## Notes for the next person

- A real Clerk session and hosted provider were not exercised.
- Node 26 produced four existing date-format assertion failures; Node 24 passed.
