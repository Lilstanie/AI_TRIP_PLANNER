---
date: 2026-10-28
author: Claude
branch: feature/TP-139-review-fixes
pr: none
area: apps/web
contract-impact: none
---

# Trip home review fixes (spec #765)

## What changed

- `layout.ts`: widening a phone window on the Trip home keeps the page and resets view to chat; select-view and show-chat-view drop `tripId`.
- `useWorkspace`: an empty Start chat reuses the trip's untouched empty chat; deleting the active trip from its home no longer starts a blank chat, so one effect in `WorkspaceView` leaves the home (kept stable through a ref).
- `useWorkspaceStorage`: a save with nothing new is skipped, so reopening a chat does not bump the trip snapshot.
- `TripHomeChats` guards an unparsable date; `useTripPlaces` rethrows AbortError from the body read and drops the extra aborted check.
- E2E `trip-home-review` with its failures file; docs, `.zh.md` and the page Agent Note updated.

## Validation

Commands listed in the final report of this session.

## Notes for the next person

- The widening check passes on the old code too; the stale `mine` view had no visible effect in the run.
