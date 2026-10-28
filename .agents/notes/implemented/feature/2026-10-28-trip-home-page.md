# Agent Note: Trip home page

Status: implemented
Owner: spec #765, ticket #770

Superseded in part: [Trip home actions stay in place](2026-10-29-trip-home-actions.md) replaces the
three navigation cards with five in-place actions and keeps Chat selection inside Trip home.

## Problem

Opening a trip dropped the traveller into one chat. Spec #765 added a Trip home in four tickets (#766 to
#769); each recorded its own piece, and nothing recorded the page as a whole, the entry points that open it,
or how its chats and plans relate to the stored trip. The walkthrough of #770 also found that opening an older
chat from the page could overwrite the trip's plan.

## Decision

- The Trip home is one page, `layout` page `home` with a `tripId`, between the Trips page and the
  conversation view. The Trips page stays the list; the page reads the trip record and writes nothing.
  Pieces: [shell and header](2026-10-28-trip-home-shell.md), [chats list and new chat](2026-10-28-trip-home-chats.md),
  the three entry cards and the map.
- Entry points: a Trips card (a Mine card on a phone), a calendar band and a trip in the Chats search. A chat
  chosen from the Chats list or from Mine still opens the conversation.
- The trip snapshot is the latest saved plan. `latestSnapshot(catalog, conversation)` returns the newer of the
  chat's own snapshot and its trip's by `savedAt`, preferring the chat's on a tie, and `selectConversation` and
  the restore of a chat with a pending question open that one. Opening a chat whose snapshot is older than its
  trip's therefore shows the trip's plan, and the save that follows writes the same plan back. Only an edit
  changes the trip. Before, the older plan was loaded and the next save replaced the trip's snapshot with it
  (the trip lost its stops after the traveller only opened the chat row).
- Chats are ordered by `tripConversations`: newest `updatedAt` first, and chats with the same instant by
  creation order, the one started last first. The catalog keeps trip chats in creation order, so the order is
  deterministic when two chats are saved in the same millisecond.
- On a phone the Calendar card opens Mine on its Calendar tab at the trip's month, and Back returns to Mine on
  the tab it came from; `PhoneMine` takes the Trips page tab and focus trip from `WorkspaceView`, as the
  desktop Trips page does.
- Verification is one walkthrough, `trip-home-walkthrough` (desktop 1440, 390 touch phone, Chinese on both),
  which leaves screenshots and `result.json`; `trip-home-older-chat` checks the stored plans.

## Alternatives considered

- Guard the save: keep the older chat's plan on screen and refuse to write it over a newer trip. The save has no
  way to tell an edit from an open, so the guard would also drop real edits made on an older chat.
- Always open the trip's snapshot for a chat: simpler, but a chat newer than its trip (imported or seeded
  data) would show an older plan than the one it holds.
- Break ties in the test by waiting a millisecond: hides the ordering defect that real double clicks reach.

## Consequences

- A chat's snapshot can lag its trip's until the chat is opened and saved; the Trip home reads the trip's.
- `restoreWorkspace` applies the same rule to a restored chat with a pending question.
- The phone Mine panel keeps the Calendar tab until another is chosen, as the Trips page tab does on desktop.
- An empty Start chat reuses the trip's untouched empty chat, and a save that changes nothing (same plan, draft,
  messages and trip plan) is skipped, so opening a chat does not move the trip snapshot forward.
- Deleting the active trip from its home does not start a blank chat; the home leaves through one effect.
- The Trip home is not restored after a reload.
