---
date: 2026-10-28
author: Claude
branch: docs/retro-pr-delivery
pr: none
area: scripts, .agents/skills, docs
contract-impact: none
---

# Add pnpm check:comments and tighten PR delivery skills after the #743 retro

## What changed

- `scripts/check-comments.mjs` and root script `check:comments`: runs the added-comment gate against the merge base with `origin/main`.
- `trip-planner-pr-delivery`: one `Closes` keyword per issue, close leftover issues after merge, set the Jira assignee on creation, token-lean Jira and GitHub calls, `pnpm check:comments`.
- `pre-push-checks`: docs row now includes `pnpm verify:pairs` and the pair link-order trap.
- `docs/development.md` and its `.zh.md` pair mention the local command.

## Why

The #743 work hit CI-only failures (added comments, zh link order) and left nine issues open after a merge.
Joey approved the root `package.json` change ("都做").

## Validation

- `pnpm verify:docs`, `pnpm verify:pairs`: passed.
- `pnpm check:comments`: outcome passed.
- `prettier --check` on changed files: passed after one `--write`.

## Notes for the next person

The `implement-spec` parallelism cap lives in an account skill, proposed separately.
