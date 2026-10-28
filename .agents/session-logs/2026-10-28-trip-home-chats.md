---
date: 2026-10-28
author: Claude
branch: feature/TP-140-home-chats
pr: none
area: apps/web
contract-impact: none
---

# Trip home lists the trip's chats and starts a new one (#767, spec #765)

## What changed

- `TripHomeChats` (component and `trip-home-chats.css`) mounted in the `TripHome` children slot: the trip's chats newest first with title and date, and a "New chat" box with a "Start chat" button.
- `newTripChat` in `useWorkspace` opens a new conversation on the trip with its plan and saves it through `upsertCurrent`.
- Chinese string "Start chat"; `docs/workspace-ui.md` and `.zh.md`; Agent Note `2026-10-28-trip-home-chats`.
- E2E `trip-home-chats` with `trip-home-chats.failures.md` written first.
- `openTripWorkspace` opens the newest row of the Trip home list; `day-menus` fixture conversation id gets the `conversation:` prefix.

## Why

The shell left a trip's chats reachable only from the Chats panel. The `day-menus` regression after #766 came from the fixture id lacking the prefix, which made the first save create a second conversation and leave the seeded one with the old plan.

## Validation

See the pull request evidence; commands are listed in the hand-off report.

## Notes for the next person

- The 520 px phone width never shows the Trip home yet; the narrow check runs at 700 px.
- Each Start chat click stores a conversation even when nothing is sent.
