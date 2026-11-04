---
date: 2026-11-05
author: Claude (refinement loop)
branch: fix/TP-377-trajectory-e2e-sidebar
pr: pending
area: apps/web/tests/e2e
contract-impact: none
---

# TP-377: Trajectory E2E scripts navigate through the sidebar entry

## What changed

- `trajectory-tab.e2e.mjs`: opens and leaves Trajectory through the sidebar Trajectory entry and
  reads its `aria-current`, instead of the Conversation/Trajectory tabs.
- `trajectory-demo.e2e.mjs`, `summary-jump.e2e.mjs`: the desktop return-to-chat step and the
  "Trajectory shown" check use the same entry instead of `#chat-tab-*`.

## Why

The chat header navigation note (2026-10-30) superseded the desktop tabs; `WorkspaceView` renders
`ChatPanel` with `showTabs={false}`, so `ChatViewTabs` never appears in the workspace and all three
scripts stopped at their first navigation step.

## Validation

- `trajectory-tab` on `main`: 0 checks reached past "the chat column has Conversation and Trajectory
  tabs". With this change: 48 `ok`; the remaining failures are turn-content checks (expected rounds,
  done/failed results) that no longer match the planner after #962.
- `trajectory-demo` on `main`: timed out waiting for `#chat-tab-conversation`. Results of this branch
  are recorded in the PR.

## Notes for the next person

- `ChatViewTabs` and `ChatPanel`'s `showTabs` are only reachable from `app/debug/question`; a later
  simplification can delete them together with the tab wording in the Trajectory Agent Note.
