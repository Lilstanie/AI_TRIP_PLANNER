---
date: 2026-10-22
author: Claude Code
branch: docs/pre-push-root-verify
pr: none
area: .agents/skills
contract-impact: none
---

# Pre-push loop runs the E2E verify scripts from the root

## What changed

- `.agents/skills/pre-push-checks/SKILL.md`: the "web fix with an E2E proof" loop runs
  `verify:e2e-selectors` and `verify:e2e-artifacts` without `--filter @trip/web`, and says why.

## Why

Both are root scripts. `pnpm -s --filter @trip/web verify:e2e-selectors` exits 0 without running
anything, so the loop printed `ok` for two checks that never ran; PR #589 went to CI with an E2E
selecting react-day-picker classes and failed there.

## Validation

- `pnpm -s --filter @trip/web verify:e2e-selectors; echo $?` prints only `0`.
- `pnpm verify:docs` on this branch.

## Notes for the next person

None.
