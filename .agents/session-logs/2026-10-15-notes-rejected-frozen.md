---
date: 2026-10-15
author: Claude Code
branch: docs/notes-rejected-frozen
pr: none
area: .agents/notes
contract-impact: none
---

# Align the notes README's rejected rule with AGENTS.md and CI

## What changed

- `.agents/notes/README.md`: a `rejected/` note is frozen and never deleted, instead of "delete it
  once its rationale no longer prevents a tempting mistake".

## Why

AGENTS.md lists `.agents/notes/rejected/**` as frozen, and `scripts/verify-protected-files.mjs`
fails a pull request that deletes a frozen file, so the README described a deletion CI would refuse.
No note has been rejected yet; the directory appears with the first one. The user approved the edit.

## Validation

- `pnpm verify:docs` and `pnpm verify:protected`: see the pull request.

## Notes for the next person

none
