---
date: 2026-10-21
author: Claude Code
branch: chore/delivery-skill-fixes
pr: none
area: .agents/skills, apps/web/tests/ci
contract-impact: none
---

# Find duplicate pull requests early and print the comment report

## What changed

- `pre-push-checks/SKILL.md` §1: list open and merged pull requests that name the issue before the first push.
- `check-comment-policy-ci.mjs`: `--output` is optional; without it the report goes to stdout only.
- `comment-policy.e2e.mjs`: new `stdout-only` case; `comment-policy.md` documents the optional flag.

## Why

The 2026-10-21 retro: #505 and #506 repeated work that #512 and #520 had already merged, and `--output /dev/stdout` failed with EPIPE because the script also prints the report.

## Validation

- `node apps/web/tests/ci/comment-policy.e2e.mjs`: before the script change it failed with `Missing --output`; after it, 19 cases passed.
- The PR search command in the skill returned #519 for issue #509.
- `pnpm verify:docs`, `pnpm verify:pairs`, `pnpm verify:protected` and Prettier on the changed files: see the pull request Evidence.

## Notes for the next person

- `search/issues` is not reachable from the cloud proxy, so the skill uses the repo-scoped `pulls` list (latest 100).
