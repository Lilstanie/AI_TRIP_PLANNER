---
date: 2026-10-22
author: Codex
branch: fix/pr-delivery-status-preflight
pr: none
area: scripts, docs, .agents/skills
contract-impact: none
---

# Make PR delivery preflight reusable for current CI states

## What changed

- Updated `scripts/pr-delivery-status.mjs` to validate exact local/PR state, required sections and check results, with one evidence-backed CLI worker skip exception.
- Extended `scripts/pr-delivery-status.test.mjs` and its failure inventory; aligned English/Chinese development docs and the review skill.

## Why

- The CI aggregate validates docs-only CLI plans, so their skipped workers are safe only when the plan and aggregate checks both succeed. Evidence wording is authored by the PR template and should not be guessed by a lexical gate.

## Validation

- `node --test scripts/pr-delivery-status.test.mjs` — 20/20 passed before integration.
- `pnpm test:scripts` — 60/60 passed on final code after rebasing onto `origin/main` at `1115442dfbde15f3e40ecc8cd0776c16715dbfc9`.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm format:check-changed origin/main` — passed after integration.

## Notes for the next person

- Fixture checks use temporary Git repositories and a fake `gh`; they do not establish GitHub CI behavior. The checker itself uses only read-only Git and `gh pr view`/`gh pr checks` calls.
