---
date: 2026-10-28
author: Claude
branch: feature/TP-143-home-walkthrough
pr: none
area: apps/web
contract-impact: none
---

# Trip home walkthrough, Agent Note and three fixes (#770, spec #765)

## What changed

- `trip-home-walkthrough` E2E (desktop 1440, 390 touch phone, Chinese on both) with `trip-home-walkthrough.failures.md` written first; screenshots and `result.json` under `output/playwright/trip-home-walkthrough/after/`.
- Stale chat snapshot: `latestSnapshot` in `lib/workspace/catalog.ts` picks the newer of a chat's snapshot and its trip's; `selectConversation` and `restoreWorkspace` use it, so opening an older chat no longer overwrites the trip's plan. E2E `trip-home-older-chat` (failure inventory first; it failed before the fix: the trip went from 2 stops to 0).
- Chat order: `tripConversations` sorts by `updatedAt`, ties by creation order, last started first; `trip-home-chats` gains a same-millisecond check with a fixed clock.
- Phone Calendar card: `PhoneMine` takes the Trips tab and focus trip from `WorkspaceView`, so the card opens Mine on the Calendar tab at the trip's month and Back returns there.
- `trip-export` phone step: the Trip tab is named "Trip updated" there, so the script matches both names.
- Agent Note `2026-10-28-trip-home-page.md`; facts updated in the chats and shell notes; docs `workspace-ui` and `development` with `.zh.md` pairs.

## Why

The trip snapshot is the latest saved plan, so the open must not load an older one. The `trip-export` failure was the script: the fixture has an activity without an ID, which gets one when the chat opens, so the plan differs from the stored one and the phone shows the update badge; the old script skipped a missing tab silently, the new helper made it required.

## Validation

See the pull request body once opened; commands run are listed in the final report of this session.

## Notes for the next person

- `trip-home-chats` "new chat leads the list" failed on the base branch only on the same-millisecond tie.
- Mine keeps the Calendar tab until another is chosen.
