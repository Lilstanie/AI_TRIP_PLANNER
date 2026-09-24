---
date: 2026-09-24
author: Claude Opus 5.5
branch: feature/trips-page-chat-flyout
pr: none
area: apps/web
contract-impact: none
---

# Chats slide-out panel, Your trips page and a resizable chat/map split

## What changed

- `WorkspaceSidebar.tsx`: only Chats and Trips (with counts) and the footer; search, New chat,
  New trip, history and Saved trips left the sidebar.
- `ChatsPanel.tsx` (new): search, New chat (new `ComposeIcon`), New trip, Trips and Chats; slides
  out beside the sidebar on desktop (`#chats-panel`, `workspace-trips.css`) and sits inside the
  narrow navigation drawer.
- `TripsPage.tsx`, `TripCover.tsx` (new): Your trips with Trips (Upcoming/Past cards) and Calendar
  tabs; `page` and `chatsOpen` state in `useWorkspaceController.ts`.
- `SplitResizer.tsx` (new), `catalog.ts` (`chatShare`, `CHAT_SHARE`): draggable chat/map divider,
  default 0.56; the Trip drawer's width follows `--chat-share` so it covers exactly the map.
- `trip-facts.css`: modal fact editors are centred vertically too; the calendar's range end no
  longer disappears under the hover style.
- Tests: `Workspace.test.tsx` updated for the panel and new tests for Your trips and the divider.
- Docs: `docs/workspace-ui.md`; new Agent Note `implemented/feature/2026-09-24-chats-panel-and-trips-page.md`;
  `2026-09-24-new-trip.md` archived because its sidebar placement is superseded.

## Why

The owner asked for Mindtrip's chats panel and Trips page, a movable chat/map split with a wider chat
by default, and a Trip drawer flush with the map edge. The When/Who/Budget editors were delegated to
a subagent; see `2026-09-24-trip-fact-chip-editors.md`.

## Validation

- `pnpm --filter @trip/web typecheck`, `lint`: pass. `pnpm verify:docs`, `verify:protected`: pass.
- `pnpm --filter @trip/web test`: 366 passed, 1 failed ("restores saved data…"), which opens the
  removed Saved trips entry; the parallel Saved trips removal deletes it.
- Browser (1440×860 and 375×812, dark): Chats panel, Your trips cards and calendar, divider drag,
  Trip drawer alignment, and the When/Who/Budget editors, which fixed the two CSS issues above.

## Notes for the next person

Saved trips (Save trip button, dialog, `trip-saved-v1`) is removed on branch
`claude/kind-feistel-b04aeb`; merging it touches the same three workspace files. Trip covers are
gradients because no photos are stored. Children, infants and pets reach the planner only as a count.
