---
date: 2026-10-27
author: Claude Code
branch: feature/TP-116-sidebar-entries
pr: none
area: apps/web, docs
contract-impact: none
---

# TP-116 Sidebar New trip, Calendar and a Chats plus

## What changed

- `WorkspaceSidebar` gained New trip, Calendar and a Chats plus; `NavButton` takes an optional `action`.
- `TripsPage` accepts a controlled `tab`; `WorkspaceView` holds it so Calendar and Trips are marked current.
- `ChatsPanel` dropped its duplicate New chat and New trip buttons; styles in `workspace-navigation.css`.
- Added `sidebar-entries.e2e.mjs` with its failures file; repointed E2E scripts off `.chats-panel__actions`.
- Updated `docs/workspace-ui.md` and its `.zh.md` pair and added the Agent Note `2026-10-27-sidebar-entries.md`.

## Why

Starting a trip or opening the calendar was two steps away; see the Agent Note.

## Validation

See the final report of the ticket for the commands run and their results.

## Notes for the next person

Several desktop and phone E2E scripts fail the same way on the integration branch before this change.
