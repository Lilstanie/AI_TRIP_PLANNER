# Agent Note: Trip home page shell

Status: implemented
Owner: spec #765, ticket #766

## Problem

Choosing a trip on the Trips page dropped the traveller straight into one chat with the Trip panel and
map around it. Nothing showed the trip as a whole, and the later pieces of spec #765 (chats of the trip,
entry cards, map) had no page to live on.

## Decision

- A Trip home is a third page of the workspace beside the Trips page and the conversation view. The layout
  surface gains `page: "home"` with a `tripId`; `open-home` sets it and `show-trips` leaves it. It reads the
  trip record only, so storage and `packages/shared` are unchanged.
- The Trips page remains the list. A trip card, a calendar band and a trip in the Chats search open the Trip
  home; a chat opened from Chats opens the conversation as before. Phone opens the Trip home too since ticket #769
  (no tab bar; Back returns to Mine), with the map stacked under the content.
- The shell is `TripHome`: a header (back button, title heading, the Trips page's Rename and Delete menu), one
  list of tags built by `tripTags` from the brief with empty values dropped, then `children` for the main
  column and an optional `aside` column. Later tickets pass sections as children; the map is `TripHomeMap` in `aside`, fed by the opened trip's plan so it never changes the active conversation.
- Three entry cards (`TripHomeCards`, ticket #768) fill the main column: Itinerary and Preferences select the
  trip with `selectTrip`, which loads the trip's own snapshot rather than a chat's, then open the Trip panel
  or the Preferences panel; Calendar opens the Trips page calendar at the trip's start month. Counts come from
  the trip's saved plan and draft and are left out at zero.
- A trip deleted while its page is open, from the menu or from the Chats panel, returns to the Trips page on
  the tab it came from; the Trips page's Undo notice restores it.
- Deleting the active trip cleared the conversation but kept `activeTripId` on the removed trip, which made
  `parseCatalog` throw. `deleteTrip` now clears it.

## Alternatives considered

- Reuse the conversation view with a different panel: keeps one page but ties the home to chat state.
- Store the opened trip in the catalog layout: survives reload but adds a stored field and a contract change.

## Consequences

- The Trip home is not restored after a reload; the app opens on the active conversation as today.
- Trips with no plan cannot exist in the catalog, since every stored trip carries a validated brief, so the
  "title and menu only" state is reached only through empty tags.
- A phone reaches a trip's conversation from the chat rows on the Trip home, or from the chat rows in Mine.
