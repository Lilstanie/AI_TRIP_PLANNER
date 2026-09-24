---
date: 2026-09-24
author: Claude Code (Opus 5.5, subagent)
branch: feature/sidebar-new-chat-trip
pr: none
area: apps/web, docs
contract-impact: none
---

# Separate New chat and New trip, restyle New chat after Mindtrip, drop two titles

## What changed

- `WorkspaceSidebar.tsx`, `workspace-navigation.css`: New chat moves below Chats/Trips/Saved trips
  as a 40 px neutral pill (ink wash, not accent); New trip is a second pill below it, always visible (the parent session moved it there from a
  compact pill beside "Your trips" that only showed with Trips selected);
  the collapsed rail has both as labelled 40 px icon buttons (`NewTripIcon` in `icons.tsx`).
- `useWorkspaceController.ts`: `newTrip` starts a blank conversation named "New trip" and opens
  the Where editor. `catalog.ts`: an untitled autosave keeps a conversation's existing title.
- `Drawer.tsx` gains `hideTitle`; the nav drawer drops its "Chats and trips" row, shows the
  sidebar logo row with the close button, and is named "Navigation". `ChatPanel.tsx` and
  `WorkspaceSkeleton.tsx` drop the "Plan together" heading; the chat region is named "Chat".
- Agent Note `implemented/feature/2026-09-24-new-trip.md`; `docs/workspace-ui.md` updated.

## Why

Mindtrip (observed in the owner's Chrome, read-only): New chat is a 223×40 pill 32 px below the
last section, `foreground/5` fill (`/10` on hover), 14 px/500, no icon; New trip is a black pill on
the Trips page header. The accent-free New chat and New trip-with-trips follow that. The built-in
browser hit a Cloudflare check on mindtrip.ai, which was not attempted.

## Validation

- `pnpm --filter @trip/web test`: 33 files, 326 tests passed. `npx tsc --noEmit` (apps/web): no
  errors. `pnpm --filter @trip/web lint`: no warnings. Prettier, `verify:docs`, `verify:protected`: pass.
- Browser, port 3002, no chat messages sent: 1440×1000 light and dark, expanded (New chat 215×40,
  32 px under Saved trips, 6 %/11 % wash on hover) and collapsed (tooltips, focus ring); keyboard
  Enter on New trip opens Where with focus on Destination, New chat focuses the composer;
  390×844 light and dark nav drawer: close button focused, dialog named "Navigation", New trip
  closes the drawer and opens the Where bottom sheet, `scrollWidth` 390.

- Parent session: split into four commits (each checked with tests, typecheck and lint), and fixed
  a flaky drawer-focus test: a previous test's New chat scheduled a composer focus for the next
  frame that stole focus, so the test now lets that frame land first. The full suite passed
  326/326 twice.

## Notes for the next person

Mouse clicks in the Browser pane at an emulated 1440×1000 landed about 20 px low, so small targets
were exercised with the keyboard. Mindtrip's collapsed rail was not inspected (collapsing would
change the owner's saved preference). A trip only reaches the Trips list once planned.
