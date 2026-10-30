# Agent Note: Trip home lists the trip's chats

Status: implemented
Owner: spec #765, ticket #767

Superseded in part: [Trip home actions stay in place](2026-10-29-trip-home-actions.md) keeps Chat
selection inside Trip home instead of navigating to the global conversation workspace.
[Trip home sends the first message](2026-10-29-trip-home-send.md) supersedes the separate Start chat
step and destination-only Chat titles.

## Problem

With the Trip home shell in place, a trip's chats were reachable only from the Chats panel, and nothing on
the page started another chat for the trip.

## Decision

- `TripHomeChats` is mounted through the `children` slot of `TripHome`. It lists the conversations whose
  `tripId` is the trip, newest `updatedAt` first (ties by creation order, the last started first), each row a button with the chat title and its date in
  the interface language. Choosing a row calls `selectConversation`, so the chat opens with the latest of
  its own snapshot and the trip's (see the [Trip home page note](2026-10-28-trip-home-page.md)).
- The bottom "New chat" composer creates a linked Chat on its first nonempty send, using the
  explicit Trip snapshot through `sendHomeTripChat`. It immediately sends the first message once.
  Focus, typing, clearing and empty submissions create nothing; failed sends retry in the same Chat.
- The list is the main route from the Trip home to a conversation. The E2E helper `openTripWorkspace`
  chooses the newest row instead of going through the Chats panel.

## Alternatives considered

- Send the typed text at once: the transport reads the state of the render that created it, so a send in
  the same tick would run on the previous chat.
- Reuse an untouched empty trip chat: avoids rows with no messages but hides the click from the traveller
  and needs a definition of untouched for trip chats.

## Consequences

- Chats use the first user message as their automatic title, preserving manual names. The heading
  shows a count and rows retain localized dates and forward affordances.
- Starting a Chat requires a nonempty message; the composer remains visible while the list scrolls.
- Opening an older chat shows the trip's newer plan, so the save that follows does not downgrade the trip;
  chats of one trip with the same `updatedAt` list the one started last first.
- The `day-menus` E2E fixture used the conversation id `menus-conversation-…` without the `conversation:`
  prefix that saving derives, so the first save added a second conversation and left the seeded one with
  the old plan. The fixture now uses the prefix.
