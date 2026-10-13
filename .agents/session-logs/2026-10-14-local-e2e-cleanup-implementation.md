---
date: 2026-10-14
author: Codex
branch: main
pr: none
area: apps/web, docs, workflow
contract-impact: none
---

# Automatically remove temporary local E2E resources

## What changed

- Remove each local run's owned build directory and temporary TypeScript config while keeping reports and evidence.
- Make explicit cleanup safe across consistent workspace device-number changes and preserve moved or replaced resources.
- Update local CLI documentation and E2E lifecycle coverage; remove the obsolete PR template and its skill-maintenance trigger.

## Why

The run command now handles normal cleanup; explicit cleanup remains available for leftovers from interrupted or older invocations. A consistent device mapping allows workspace remounts without weakening inode, creation-time, type, or ownership checks.

## Validation

- `pnpm test` — passed, 6 package jobs; web: 52 files and 622 tests.
- `pnpm typecheck` — passed.
- `node apps/web/tests/cli-e2e/local-cleanup.e2e.mjs` — passed; evidence at `output/e2e/local-cli-cleanup-e2e/result.json`.
- `pnpm verify:docs`, `pnpm verify:protected`, Prettier check, and `git diff --check` — passed.

## Notes for the next person

The unrelated dirty Android shortcuts file still has a pre-existing license-notice deletion; it was left untouched and will not be included in this commit.
