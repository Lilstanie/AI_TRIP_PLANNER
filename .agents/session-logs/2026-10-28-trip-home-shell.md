---
date: 2026-10-28
author: Claude
branch: feature/TP-139-home-shell
pr: none
area: apps/web
contract-impact: none
---

# Trip home page shell opened from Trips (#766, spec #765)

## What changed

- New `TripHome` page (`components/workspace/TripHome.tsx`): back button, title heading, Rename and Delete menu reusing `HistoryMenu`, one tag list from `tripTags`, `children` and `aside` slots for #767, #768 and #769.
- Layout surface gains `page: "home"` and `tripId`; `WorkspaceView` opens it from the Trips card, the calendar and the Chats search, and returns to Trips when the trip disappears.
- `deleteTrip` clears `activeTripId` when the deleted trip is the active one; before, `parseCatalog` threw.
- Chinese string "Back to trips"; `docs/workspace-ui.md` and `.zh.md`; Agent Note `2026-10-28-trip-home-shell`.
- E2E `trip-home-shell` with `trip-home-shell.failures.md` written first.

## Why

The bare-conversation entry gave no page about the whole trip. The active-trip crash surfaced when Delete ran on the trip a chat had made active; it exists on the Trips page too.

## Validation

- `pnpm --filter @trip/web e2e trip-home-shell --prod`: all checks pass (English and Chinese, 1440 px).
- `pnpm lint`, `pnpm typecheck`, `verify:docs`, `verify:pairs`, `verify:protected`, `verify:e2e-selectors`, `verify:e2e-artifacts`, `check-ui-copy`: pass.

## Notes for the next person

- Phone still opens a trip's conversation from Mine; the home page for phones is a later ticket.
- Until #767 lists the chats, a trip's conversation is reached from the Chats panel.
- Older raw scripts that click a Trips card and expect the conversation need that step updated.
