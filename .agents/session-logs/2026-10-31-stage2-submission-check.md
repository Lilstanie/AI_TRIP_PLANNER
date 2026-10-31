---
date: 2026-10-31
author: Claude Code
branch: docs/TP-66-stage2-submission
pr: none
area: docs, submission
contract-impact: none
---

# Stage 2 submission page and the production-start restriction in the demo runbook

## What changed

- `submission/stage2/README.md`: run steps from the Canvas copy, evidence per marking criterion and
  the advanced technologies table.
- `docs/demo-runbook.md` and `.zh.md`: a production server without Clerk keys serves mock data and
  makes no model calls; use `pnpm dev` or add Clerk keys to demo DeepSeek and live data.

## Why

The runbook said only Vercel restricts data without auth and that the model key alone decides model
calls. `apps/web/lib/auth/live-data.ts` blocks both whenever `NODE_ENV` is `production`, and
`/api/data-mode` on a fresh `pnpm build` and `start` returned `liveBlock: "auth-not-configured"`.

## Validation

- `git archive` of `main` at 0c65a48, then `pnpm install --frozen-lockfile` (13 s, warm store) and
  `pnpm build` (1 min 36 s) succeeded; `GET /api/data-mode` returned `configured: mock`,
  `liveAvailable: false`.
- `pnpm verify:docs`: valid. `check-pairs.mjs`: 34 pairs checked.

## Notes for the next person

`GEOAPIFY_API_KEY` is read by `packages/tools` but is not in `.env.example` (protected file).
