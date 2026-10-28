# Agent Note: Trip home lists the trip's chats

Status: implemented
Owner: spec #765, ticket #767

## Problem

With the Trip home shell in place, a trip's chats were reachable only from the Chats panel, and nothing on
the page started another chat for the trip.

## Decision

- `TripHomeChats` is mounted through the `children` slot of `TripHome`. It lists the conversations whose
  `tripId` is the trip, newest `updatedAt` first (ties by creation order, the last started first), each row a button with the chat title and its date in
  the interface language. Choosing a row calls `selectConversation`, so the chat opens with the latest of
  its own snapshot and the trip's (see the [Trip home page note](2026-10-28-trip-home-page.md)).
- A box named "New chat" and a "Start chat" button call `newTripChat(tripId, text)`. It opens a copy of the
  trip's snapshot with no messages and the typed text as the composer input, under a new conversation id,
  and saves it with `upsertCurrent`, which links the conversation to the trip. Nothing is sent; an empty
  box still starts a chat. A trip with no chats renders only the box.
- The list is the main route from the Trip home to a conversation. The E2E helper `openTripWorkspace`
  chooses the newest row instead of going through the Chats panel.

## Alternatives considered

- Send the typed text at once: the transport reads the state of the render that created it, so a send in
  the same tick would run on the previous chat.
- Reuse an untouched empty trip chat: avoids rows with no messages but hides the click from the traveller
  and needs a definition of untouched for trip chats.

## Consequences

- Chats of one trip share a generated title (destination and dates), so the date tells them apart until
  the traveller renames them.
- Every Start chat click stores one more conversation, even if the traveller sends nothing.
- Opening an older chat shows the trip's newer plan, so the save that follows does not downgrade the trip;
  chats of one trip with the same `updatedAt` list the one started last first.
- The `day-menus` E2E fixture used the conversation id `menus-conversation-…` without the `conversation:`
  prefix that saving derives, so the first save added a second conversation and left the seeded one with
  the old plan. The fixture now uses the prefix.
