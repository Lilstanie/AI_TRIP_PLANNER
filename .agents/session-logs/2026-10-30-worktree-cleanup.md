---
date: 2026-10-30
author: Claude Code
branch: chore/worktree-cleanup
pr: none
area: scripts, .agents/skills, docs
contract-impact: none
---

# Add a dry-run-first worktree clean-up script and call it after every merge

## What changed

- `scripts/worktrees.mjs`: lists worktrees and leftovers by category; `--apply` moves clean
  worktrees, build output, marker-only directories under `~/.codex/worktrees` and unregistered clean
  clones to the Trash, then runs `git worktree prune`. It never deletes a branch.
- `scripts/worktrees.failures.md` (written first) and `scripts/worktrees.test.mjs`.
- `trip-planner-pr-delivery` §6, `implement-spec` step 9 and `pre-push-checks` §5 now run it after a
  merge; `docs/development.md` and its Chinese pair describe it.

## Why

A Codex retro found 58 marker-only directories, several Next build directories of hundreds of MB and a
1.4 GB unregistered clone left behind after runs, and `rm -rf` is blocked by the command safety layer.
Moving to the Trash keeps every clean-up recoverable. The script lives under `scripts/` and runs with
`node`, so the root `package.json` (protected) did not change.

## Validation

- `node --test scripts/worktrees.test.mjs`: 3 passed. Five mutations (move dirty worktrees, move
  clones with unpushed commits, move locked worktrees, act without `--apply`, loosen the marker-only
  check) each made the suite fail.
- `pnpm test:scripts`, `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm format:check-changed`,
  `pnpm verify:protected`: passed.

## Notes for the next person

- Not run on a real Mac yet; run `node scripts/worktrees.mjs` (dry run) first.
- A worktree restored from the Trash after the prune needs `git worktree repair` or a fresh
  `git worktree add`; its files are intact.
