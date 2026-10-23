---
date: 2026-10-22
author: Claude Code
branch: chore/delivery-redgreen
pr: none
area: scripts, .agents/skills, docs
contract-impact: none
---

# A red/green E2E command and the per-fix check loop

## What changed

- `scripts/redgreen.mjs`: runs one E2E script with the named source paths at their `origin/main`
  version, then with the working tree, restores the tree even when interrupted, and prints two
  pasteable lines. Exit 0 only when the first run fails and the second passes.
  `scripts/redgreen.failures.md` was written first; `scripts/redgreen.test.mjs` checks it against a
  temporary repository with a fake E2E command.
- `pre-push-checks`: description names batch issue fixing; fetch before every new branch; a
  "web fix with an E2E proof" block with the check loop and the comment-policy command.
- `e2e-maintenance`: traps this app has already hit.
- `docs/development.md` and its Chinese pair: the command.

## Why

The 2026-10-22 cleanup retro: the red/green proof and the same checks were typed by hand seven
times, two stashes missed a path, one branch was cut from a stale `origin/main`, and each trap
cost a rerun.

## Validation

- `node --test scripts/redgreen.test.mjs`: 9/9 pass.
- `node scripts/redgreen.mjs --base 011af73~1 chat-rows-same-trip -- apps/web/components/workspace/useWorkspace.ts`
  (the #578 fix): before exit 1, 2/4 ok; after exit 0, 4/4 ok; exit 0; working tree clean after.
- The documented check loop, plus `test:scripts`, printed `ok` for every row.

## Notes for the next person

The fake E2E self-check proves only the restore logic, not browser behaviour.
