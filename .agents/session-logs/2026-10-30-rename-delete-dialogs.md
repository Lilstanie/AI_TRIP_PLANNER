---
date: 2026-10-30
author: Claude
branch: feature/TP-144-trip-home-workspace
pr: 782
area: apps/web, docs
contract-impact: none
---

# In-app rename and delete dialogs

## What changed

- Replaced `window.prompt` and `window.confirm` for Chat rename, Trip rename and Chat delete with
  the shared `Dialog`, owned by `WorkspaceDialogs` and driven from `useWorkspace`.
- `HistoryMenu` returns focus to its trigger so a cancelled dialog does not lose focus.
- Moved the browser scripts off native dialog handlers and off the removed desktop `.topbar-title`.
- Top bar: Trip stays at the far right without a count; a Chat outside a Trip shows a plain title and
  no menu; the sidebar toggles Trajectory back to Conversation.
- UI fixes from a local review: Dismiss button layout, Trip home composer bottom gap, dialog styling,
  title menu no longer covers the Trip name, round back button, and the Chats panel stays open while
  its rename or delete dialog is used.
- Trip panels: Expand no longer narrows the panel on wide windows, tabs and Expand stay in the panel
  head, preferences have padding, and Chat and booking rows lose the grey pill.
- The sidebar Calendar reuses the Trip home calendar with a Trip picker; old month bands and four
  `calendar-*` scripts are gone.
- Copy trip and Download calendar moved into the Itinerary menu at the panel corner; the unplaced map
  state is one line.
- Removed Expand panel: on desktop the action panel always opens beside the map.
- The Trip home suggestion is one row with a specific action, an icon Dismiss and correct singular text.
- Removed overlapping scripts `trip-home-walkthrough`, `trip-home-review`, `trip-home-cards`,
  `trip-home-action-rail`, `trip-home-preferences`, `trip-home-shared-editor`,
  `trip-home-ideas-bookings`, `trip-fact-editors` and `map-renderer-lifecycle`. The null dismissal record and quota failures
  moved into the CI-registered `trip-home-send`.

## Why

Native prompts cannot be styled, translated at the button level or kept in the workspace focus order.
The owner asked for a top bar closer to Mindtrip and for fewer tests.

## Validation

Recorded in the PR #782 Evidence section from the runs of this session.

## Notes for the next person

Replacing an edited plan still uses `window.confirm` in `useWorkspaceTransport.ts`; that path was out
of scope. Do not commit `.cursor/`, `.next-*` or `.tsconfig-*`.
