---
date: 2026-10-30
author: Codex
branch: feature/TP-151-new-chat
pr: none
area: apps/web, docs
contract-impact: none
---

# TP-151 Standards cleanup for New chat review

## What changed

- Restored the in-flight New chat Vitest case to tip length; E2E owns the return path.
- Removed the duplicate `estimateChange` key in `session.test.ts`.
- Left Workspace.test Intl spacing WIP and `#795` panel E2E files unstaged.

## Why

Independent Standards on `61900cdc` failed for post-implementation unit growth and duplicate-key noise after the New chat feature landed.

## Validation

- Staged only the Standards cleanup files before this commit.
- Exact-HEAD browser evidence and Spec/Standards/Ponytail reruns follow on the new HEAD.

## Notes for the next person

- Keep `#795` panel files and Intl WIP out of this ticket.
- No push, merge, Jira, Astra, or protected-config change from this worktree.
