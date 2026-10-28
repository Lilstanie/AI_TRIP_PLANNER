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

- `sidebar-no-chat-plus --prod`: red first (Mine selector clash), then ok; `sidebar-entries --prod`: ok. Output in `apps/web/output/playwright/sidebar-no-chat-plus/`.
- Updated scripts `progressive-empty-workspace`, `workspace-walkthrough`, `liquid-glass`: ok. `settings`, `workspace-performance`, `check-entry-point` fail the same way on the parent commit (settings and performance verified there; check-entry-point is listed in `docs/e2e-known-failures.md`). `profile-home-base` fails on its first Where click, before the changed lines.
- `vitest run tests/components/workspace`: 45 passed. `tsc --noEmit`, `check:comments`, `verify:docs`, `verify:pairs`: clean.

## Notes for the next person

The component tests in `apps/web/tests/components/workspace` now start blank conversations with New trip.
