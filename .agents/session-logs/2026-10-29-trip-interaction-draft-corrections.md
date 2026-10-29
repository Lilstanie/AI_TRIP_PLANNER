---
date: 2026-10-29
author: Codex
branch: feature/TP-144-trip-home-workspace
pr: 782
area: docs
contract-impact: none
---

# Add Chat entry, generation continuity and shared Itinerary requirements to the draft

## What changed

- Updated proposed `2026-10-29-mindtrip-interaction-spec` with seven vertical ticket drafts.
- Added global New chat without mandatory Trip creation; Trip home creates a linked Chat only
  on first nonempty Send and removes the separate Start chat button.
- Defined in-app generation continuity and the common Itinerary/top-right Trip editor state.
- Added map lifecycle and Chat-owned generation tickets with explicit integration dependencies.
- Updated proposed alignment note with user corrections and cancellation-policy conflict.

## Validation

- Inspected `useWorkspace`, `useWorkspaceTransport`, `WorkspaceSidebar`, `WorkspaceView`.
- Confirmed loading a Chat/Trip calls `open`, aborting the active controller; transport ignores
  results once that controller loses ownership. Layout-only page navigation may take another path.
- Generic page-switch output loss still needs a controlled delayed-stream browser reproduction.
- Documentation, pairing, protected-file and scoped formatting checks run in this turn;
  results reported in the final response. No application tests needed for draft-only edits.

## Notes for the next person

- Draft review precedes GitHub/Jira publication and implementation; continue PR #782, never merge.
- Generation continuity is browser-session scope, not durable server execution after close/reload.
- Existing catalog/storage cancellation policy needs explicit supersession during implementation.
- No product source changes, ticket publication, push or PR update in this turn.
