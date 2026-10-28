---
date: 2026-10-28
author: Claude
branch: feature/TP-133-trajectory-switch
pr: none
area: apps/web, docs
contract-impact: none
---

# Conversation and Trajectory close the open Trip panel (TP-133, #759)

## What changed

- `lib/workspace/layout.ts`: the chat view is part of the surface (`chatView`); the new `show-chat-view` event closes the Trip drawer and selects the view in one step.
- `WorkspaceView.tsx`, `useWorkspace.ts`: the tabs, `ChatPanel` and `sendFromTrip` dispatch it; the local `chatView` state is gone. A team jump while Trip is open also dispatches it.
- `trajectory-focus.tsx`, `ChatPanel.tsx`: a `claim` on the focus nonce lets a remounted chat apply a jump made while it was hidden.
- `trajectory-with-trip-open` E2E script and failure inventory; `docs/workspace-ui` paragraph (en, zh).

## Why

The tabs changed `useState` in `WorkspaceView` while `surface.drawer` stayed `"trip"`, so the Trip panel kept replacing the chat. Red run: tab `aria-selected` was `trajectory` while `.trip-workspace` stayed shown.

## Validation

`trajectory-with-trip-open --prod`: red before (5 failures), green after (12 checks). Output in `apps/web/output/playwright/trajectory-with-trip-open/`.

## Notes for the next person

none
