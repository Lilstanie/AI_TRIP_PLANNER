---
date: 2026-10-19
author: Codex
branch: fix/pending-ask-progress
pr: https://github.com/Lilstanie/AI_TRIP_PLANNER/pull/448
area: apps/web, docs
contract-impact: none
---

# Keep pending-question progress compatible with saved catalogs

## What changed

- Workspace catalogs now write schema version 5 and continue reading version 4.
- Updated the implemented architecture note to describe optional pending-question progress.

## Validation

- `pnpm --filter @trip/web test` — passed, 57 files and 632 tests.
- `pnpm --filter @trip/web typecheck` — passed.
- `pnpm --filter @trip/web lint` — passed.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected` — passed.
- `pnpm exec prettier --check` on the changed note, catalog and test — passed.
- `git diff --check origin/pr-448` — passed.

## Notes for the next person

- The isolated worktree initially had no installed dependencies; `pnpm install --frozen-lockfile` restored the workspace without changing the lockfile.
- Existing version 4 catalogs remain readable and normalize on the next write.
