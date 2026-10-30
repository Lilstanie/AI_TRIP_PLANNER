# Agent Note: A chat that opens a trip is named after the trip

Status: implemented

## Problem

Automatic chat titles were the whole first user message, so after planning the chat header, the
Chats list and Trip home showed the traveller's own prompt ("Plan 4 days in Lisbon from Sydney, 2
people, …") cut off mid-word, and chats about different trips could not be told apart by place and
dates.

## Decision

- Joey chose this on 2026-10-30. It supersedes the automatic-title rule in
  [Trip home chats](2026-10-28-trip-home-chats.md) and [Trip home send](2026-10-29-trip-home-send.md).
- The chat that opens a trip (the trip's first conversation) is titled by the trip's destination and
  dates (`titleFor` in `apps/web/lib/workspace/catalog.ts`), shown in the interface language by
  `conversationTitle`, and follows the plan when its dates change.
- A later chat in the same trip, and a chat whose plan has no destination, keeps the first user
  message, collapsed and cut at 72 code points, so a trip's chats stay distinguishable.
- A renamed chat keeps its name.
- Existing chats take the new title the next time they are saved.

## Alternatives considered

- Keep the first message: rejected by Joey; it repeats the prompt and truncates in the sidebar,
  Chats list and phone header.
- Name every chat of a trip after the trip: Trip home would list identical rows.

## Consequences

- `chat-trip-title` E2E covers English and Chinese titles, the Chats list, a second chat from Trip
  home and a renamed chat.
