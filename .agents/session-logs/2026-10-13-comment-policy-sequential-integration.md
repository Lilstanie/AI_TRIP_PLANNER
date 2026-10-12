---
date: 2026-10-13
author: Codex
branch: feature/comment-policy-ci
pr: 319
area: testing, docs
contract-impact: none
---

# Integrate comment policy after CLI scheduling delivery

## What changed

- Merged main at `0775728` after PR #318, preserving both deliveries.
- Resolved only the translation hash conflict by reviewing the merged development EN/ZH pair.
- Regenerated that pair record; production code and comment-policy implementation unchanged.

## Validation

- `node apps/web/tests/ci/comment-policy.e2e.mjs`: 18 adapter cases passed.
- `pnpm verify:docs`, `pnpm verify:pairs` (26 pairs), `pnpm verify:protected`: passed.
- `git diff --check --cached`: passed before this log was added.

## Notes for the next person

Previous CI is evidence for the previous tree only. Fresh integration CI must pass before merge.
User authorized sequential merging of #318, #319 and #320. Original main worktree stays untouched.
