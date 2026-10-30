---
date: 2026-10-30
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: apps/web, docs
contract-impact: none
---

# Chat title menu and sidebar Trajectory

## What changed

- Added `ChatHeaderMenu` and `chat-header.css`; wired it through `WorkspaceView` / `PhoneTripTitle`.
- Moved Trajectory into `WorkspaceSidebar`; Return to chat restores Conversation.
- Added move / new-trip / detach helpers in `useWorkspace`, plus `chat-header` E2E.
- Compacted tablet topbar/notice CSS so the opened Chat composer stays inside 720px.

## Why

Match Mindtrip’s Chat title menu and keep tablet first-send reachable after the taller header.

## Validation

- `BASE_URL=http://127.0.0.1:3016 E2E_OUTPUT_DIR=output/playwright/chat-header/final-verify node apps/web/tests/e2e/chat-header.e2e.mjs` PASS
- `pnpm --filter @trip/web e2e run trip-home-send` PASS (`2026-10-30T06-05-59-606Z-33723-x2ilo3`)
- `pnpm --filter @trip/web e2e run new-chat chat-generation trip-home-send` PASS (`2026-10-30T06-09-50-212Z-34895-2rih86`)

## Notes for the next person

Do not commit `.cursor/` or `.next-*`.
