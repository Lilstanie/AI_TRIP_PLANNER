---
date: 2026-10-25
author: Claude Opus 5.5 (project thread)
branch: fix/TP-83-chat-menu-name-separator
pr: none
area: apps/web
contract-impact: none
---

# Chat menu name separator

## What changed

- `apps/web/components/workspace/WorkspaceSidebar.tsx`: `HistoryMenu` takes an optional `subtitle` and
  names its trigger and menu with the existing `"Actions for {v0}, {v1}"` key when one is given.
- `apps/web/components/workspace/ChatsPanel.tsx`: chat rows pass title and subtitle separately instead
  of joining them with a literal ", ".
- `apps/web/tests/e2e/chat-menu-name-zh.e2e.mjs`: plans the Chinese example trip and reads the chat
  row's ⋮ button name on Mine at 390 px.
- `docs/workspace-ui.md` and `docs/workspace-ui.zh.md`: one sentence.

## Why

Issue #665 (Jira TP-83): the Chinese ⋮ button name read "…, 前往 悉尼 的行程的操作" with an English comma.

## Validation

- `node scripts/redgreen.mjs chat-menu-name-zh -- apps/web/components/workspace/WorkspaceSidebar.tsx apps/web/components/workspace/ChatsPanel.tsx`:
  before exit 1, 2/4 ok; after exit 0, 4/4 ok.

## Docs and Agent Notes

`docs/workspace-ui.md` and its zh pair. No Agent Note.
