---
date: 2026-10-04
author: Codex
branch: feature/localisation-currency
pr: none
area: apps/web, packages, docs, submission
contract-impact: packages/shared
---

# Merge team main while preserving the local UI work

## What changed

- Saved the local language, currency and sidebar-spacing work in commit `66cce0c`.
- Merged team main at `c59f751`, including Agent Lab replay, benchmarks, failures, live gate, transport choices and Stage 1 deliverables.
- Preserved both sets of workspace UI documentation and regenerated its translation-pair hashes to resolve the sole merge conflict.
- Shared contract changes and their Agent Notes are inherited from upstream; no new contract was introduced locally.

## Validation

- `corepack pnpm --filter './packages/**' --filter @trip/web -r run typecheck` — passed for all six packages.
- `corepack pnpm --filter @trip/web lint` — passed.
- `corepack pnpm --filter './packages/**' --filter @trip/web -r run test` — passed: shared 49, services 4, tools 113, agents 124, orchestrator 223, web 450.
- Localisation/currency browser E2E — passed, including language switching, persisted currency, 8 px sidebar gutter and phone overflow checks.
- `verify:docs`, `verify:pairs` (20 pairs), and `verify:protected` — passed.
- `/api/data-mode` returned mock configuration and `/agent-lab` returned HTTP 200.

## Notes for the next person

- Root Turbo typecheck/test initially failed because it selected the runtime's pnpm 11 instead of project pnpm 9; direct Corepack recursive commands passed.
- Existing jsdom canvas warnings remain non-failing. Real-key provider flows and a new production build were not run during this merge.
- This merge is local; nothing was pushed to GitHub.
