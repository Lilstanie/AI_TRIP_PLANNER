---
date: 2026-10-30
author: Codex
branch: feature/TP-151-new-chat
pr: none
area: docs
contract-impact: none
---

# Restore escaped pipes in workspace UI tables

## What changed

- Restored the escaped `Conversation \| Trajectory` cell in `docs/workspace-ui.md` and `.zh.md`.
- Left the Workspace.test Intl WIP uncommitted.

## Why

Independent Standards on `daf2b201` found that merge-conflict resolution removed the escapes,
splitting both rendered layout tables into an extra column.

## Validation

- Standards review on `daf2b201` failed only for the two missing table escapes.
- The exact-HEAD browser evidence remains valid for the docs-only fix.

## Notes for the next person

- Keep the Intl WIP out of this ticket.
- No push, integration merge, Jira, Astra, or protected-config change from this worktree.
