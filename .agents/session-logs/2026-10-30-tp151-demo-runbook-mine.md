---
date: 2026-10-30
author: Codex
branch: feature/TP-151-new-chat
pr: none
area: docs
contract-impact: none
---

# Align demo-runbook Mine empty state with New chat

## What changed

- Updated redesigned walkthrough step 1 in `docs/demo-runbook.md` and `.zh.md`.
- Mine now documents Trips and Chats with New trip and New chat.
- Left Workspace.test Intl WIP and `#795` panel E2E files unstaged.

## Why

Independent Standards on `ca2c864f` failed because step 1 still claimed one Mine action after New chat landed.

## Validation

- Docs-only change; prior exact-HEAD browser evidence on `ca2c864f` remains the product baseline.
- Spec/Standards/Ponytail reruns follow on the new HEAD.

## Notes for the next person

- Keep `#795` panel files and Intl WIP out of this ticket.
- No push, merge, Jira, Astra, or protected-config change from this worktree.
