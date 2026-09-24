# Agent Note: Chats slide out as a panel; Trips opens the Your trips page

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

The sidebar held everything at once: search, Chats, Trips and Saved trips with counts, New chat and
New trip pills, and one history list that switched between chats and trips. The repository owner
asked for Mindtrip's arrangement instead: Chats opens a panel that slides out beside the sidebar
(search, New chat, New trip, then trips and chats), and Trips opens a Your trips page with Trips and
Calendar tabs. Saved trips was to go, because every planned trip is already kept in the catalog and
listed under Trips. This replaces where the
[New trip note](../../archived/feature/2026-09-24-new-trip.md) put New trip; what New trip does is
unchanged.

## Decision

- The sidebar keeps only its navigation: Chats and Trips, with counts, plus the footer. The Chats
  button toggles `ChatsPanel` in a `#chats-panel` region absolutely positioned at the sidebar's
  right edge (`left: var(--sidebar-width)`), sliding and fading in over 240 ms. Opening it focuses
  its search; Escape (unless a history menu or dialog is open) closes it and returns focus to Chats;
  a press outside it closes it. It is `inert` while closed.
- The panel lists, in order: search, New chat (a pencil-and-square icon), New trip (the suitcase
  with a plus), Trips (a small cover and "Trip to <destination>"), Chats (title, and the linked
  trip's name under it). Search filters both lists, as the old sidebar search did.
- Trips switches the main area to `TripsPage` (`page: "workspace" | "trips"` in the controller).
  Its Trips tab shows every trip as a cover card split into Upcoming and Past; its Calendar tab
  draws each trip as a band over a Monday-first month grid. Choosing a trip, a chat, New chat or
  New trip returns to the workspace.
- Trips keep no photos, so covers are a gradient picked by hashing the destination (`TripCover`),
  the same trip always getting the same colours.
- On narrow screens the navigation drawer shows the sidebar with the panel's content under it.
- Saved trips leaves the sidebar. The Save trip button and its dialog are left for a separate
  change.
- The chat and map split is now adjustable: `--chat-share` (default 0.56, chat slightly wider)
  sets the grid, a separator between them drags or steps it between 0.3 and 0.75, and the layout
  stores `chatShare` only once the traveller moves it. The trip drawer's width is
  `(1 - --chat-share) × 100%`, so it always covers exactly the map.

The catalog version is unchanged; `chatShare` is an optional layout field that older catalogs lack.
`packages/shared` is unchanged.

## Alternatives considered

- **Keep the history in the sidebar and add a Trips page beside it.** Rejected: the owner asked
  for the slide-out panel, and two lists of the same trips would compete.
- **A Your trips page as a route (`/trips`).** Rejected for now: the workspace is one client page
  whose state (the active chat, in-flight requests) would be torn down by navigation; a page state
  in the controller keeps it.
- **Real place photos on trip covers.** Rejected for now: photo names come from live Places lookups
  that Google forbids caching, so there is nothing stored to show offline or in mock mode.

## Consequences

- Starting a chat or trip takes two clicks from the rail (Chats, then New chat or New trip), or
  one from the Your trips page's New trip.
- The Save trip button still writes snapshots that nothing in the sidebar opens until the saved
  snapshot feature is removed.
- The Calendar tab shows trips only; there are no bookings, so Mindtrip's Receipts tab and "Booked
  only" filter have no counterpart.

## Sources

Screenshots of Mindtrip's Trips page and chats panel supplied by the owner on 2026-09-24; no
Mindtrip copy, assets or styling were reused.
