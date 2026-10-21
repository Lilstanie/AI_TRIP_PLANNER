---
date: 2026-10-21
author: Claude Code
branch: docs/delete-merged-branches
pr: none
area: .agents/skills, docs
contract-impact: none
---

# Delete a pull request's branch after it merges

## What changed

- `pre-push-checks/SKILL.md` gains "5. After the merge": delete the merged or closed pull request's remote and local branch, and check other branches with `git cherry` before deleting them.
- `docs/development.md` and `docs/development.zh.md` point to that step next to `pnpm clean:output`.

## Why

The repository had about 45 stale remote branches from merged or closed pull requests, and auto-delete on merge is off.

## Validation

- `pnpm verify:docs`, `pnpm verify:pairs` (27 pairs), `pnpm verify:protected` and Prettier on the changed files: passed.

## Notes for the next person

- `refactor/check-entry-point` and `refactor/settle-path` share no history with `main` and have no pull request; they are left for their owner.
