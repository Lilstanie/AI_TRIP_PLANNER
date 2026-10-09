---
date: 2026-10-10
author: Codex
branch: chore/e2e-guardrails
pr: 269
area: docs, .agents, integration
contract-impact: none
---

# Integrate E2E guardrails after the trip drawer and map fallback

## What changed

- Merged current `main` into PR #269 after #258 and #278 landed in order.
- Reconciled `.agents/translation-pairs.json`, preserving records from both branches.
- Reviewed the merged English/Chinese development changes and recorded the resulting pair.
- Kept both branches' code, CI checks and E2E runner behavior unchanged.

## Why

The only merge conflict was in reviewed document hashes. Neither branch's hashes describe
the combined development page; the merged page needs its own review record.

## Validation

- `pnpm typecheck`: six packages successful, five from Turbo cache.
- `pnpm test:scripts`: 35 tests passed.
- `pnpm verify:e2e-selectors`: all selected classes have web sources.
- `pnpm verify:docs`: notes, skills and links valid.
- `pnpm verify:pairs`: 25 reviewed pairs valid.
- `pnpm verify:protected`: protected rules hold relative to `origin/main`.
- `pnpm format:check-changed origin/main`: outgoing committed files formatted.
- `git diff --check --cached`: passed after conflict resolution.

## Notes for the next person

Fresh remote CI and deployment checks gate the final merge. This integration adds no new
runtime behavior and does not rerun browser E2E or establish live-provider/device evidence.
The new simplification tickets #280–#290 remain separate, unimplemented follow-up work.
