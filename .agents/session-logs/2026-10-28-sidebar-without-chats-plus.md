---
date: 2026-10-28
author: Claude
branch: feature/TP-132-sidebar-plus
pr: none
area: apps/web, docs
contract-impact: none
---

# Remove the plus beside Chats in the sidebar (TP-132, #758)

## What changed

- `WorkspaceSidebar.tsx`: the Chats plus, the drawer New chat row, `NavButton`'s `action` and `onNewChat` are gone; `WorkspaceView.tsx` stops passing it; `workspace-navigation.css` loses the row and action rules.
- `sidebar-no-chat-plus` E2E script and failure inventory; `sidebar-entries` and seven other scripts that clicked the plus now use New trip.
- `docs/workspace-ui` (en, zh), a new Agent Note, and a superseded line in the sidebar entries note.

## Why

Spec #755: New trip is the one sidebar entry for a new conversation. Phone Mine keeps its own button.

## Validation

See the commit report; commands and results are listed in the hand-off.

## Notes for the next person

Unit tests under `apps/web/tests/components/workspace` that click the sidebar New chat need the same move.
