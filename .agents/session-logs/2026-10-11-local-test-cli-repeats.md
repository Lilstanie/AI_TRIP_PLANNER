---
date: 2026-10-11
author: Codex
branch: feature/local-test-cli-297
pr: none
area: apps/web, docs
contract-impact: none
---

# Add serial local E2E repeats

## What changed

- Added `repeat-cli.mjs` and dispatch from `run.mjs`; each attempt launches the public local CLI in a fresh child process.
- Added the repeat E2E for invalid counts, interrupted-child failure aggregation, fixture `runId` separation, parent interruption, and human-readable output.
- Added paired usage guidance and refreshed the reviewed documentation-pair hashes.

## Why

Each ordinary invocation already owns its build, server, browser process and evidence. Repetition runs that same boundary serially, keeping attempt records and failure evidence while preserving the user's requested CLI selection arguments.

## Validation

- `node apps/web/tests/cli-e2e/local-test-cli-repeat.e2e.mjs` — passed; repeat summary: `output/e2e/local-test-cli/repeat-2026-10-10T14-10-27-952Z-94324-dzajcm/summary.json`; parent-interruption summary: `output/e2e/local-test-cli/repeat-2026-10-10T14-11-33-129Z-95124-kaljjb/summary.json`.
- `node apps/web/tests/cli-e2e/discovery.e2e.mjs` — passed after merging the current integration branch.
- `pnpm verify:docs`, `pnpm verify:protected`, `pnpm verify:pairs`, `pnpm verify:e2e-selectors` — passed.
- `pnpm format:check-changed origin/main`, scoped Prettier and `git diff --check` — passed.

## Notes for the next person

The current integration merge includes #295 discovery. Repeat parsing removes only `--repeat`; selection and timeout arguments remain owned by the child `run` parser, so the module composes with collection support. The #296 collection implementation is still in its assigned worktree at this point.
