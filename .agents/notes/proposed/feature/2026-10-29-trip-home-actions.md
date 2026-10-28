# Agent Note: Trip home actions stay in place

Status: proposed
Owner: repository owner (@HeadmasterEggy)

## Problem

The current Trip home already groups the Trip's Chats and shows its map, but its Itinerary, Calendar
and Preferences cards leave the page. Calendar opens the global Trips calendar, Itinerary opens the
conversation Trip panel, and Preferences opens a fact editor. The repository owner wants the
Mindtrip arrangement: the selected Trip stays in context, its Chats occupy the centre, and five Trip
actions sit above a map on the right. Calendar is the clearest failure in the current flow because
replacing the page with the global calendar gives the traveller no obvious return.

This proposal extends the [Trip home page](../../implemented/feature/2026-10-28-trip-home-page.md)
rather than replacing its entry points, Plan ownership or Chat links.

## Proposal

- Keep Trip home as page `home` with the Trip's title, facts, Rename and Delete menu, map and all
  Chats linked by `tripId`. Do not choose one Chat merely to open the Trip.
- On desktop, put Itinerary, Ideas, Bookings, Trip preferences and Calendar above the map in a
  right rail. Put the title, facts, contextual suggestion, Chats and composer in a centred main
  column.
- Open every action in a right-side drawer without leaving Trip home. The desktop drawer covers the
  rail and keeps the main column visible; a phone drawer is full screen. No Media entry is added
  until a real media model exists.
- Itinerary contains the complete plan and day timeline and focuses the map when a day is chosen.
  Ideas contains unscheduled activities and restaurant suggestions. Bookings groups flights, stays
  and items marked as booked. Trip preferences reuses the existing preference editor. Calendar is a
  redesigned read-only calendar for the open Trip only; choosing a day opens Itinerary at that day
  and focuses the map.
- Drawers close through a close button, Escape or an outside press and restore focus to the opening
  card. Only one action drawer is open, and its state belongs to the existing workspace layout
  reducer.
- Opening an existing Chat replaces the dashboard in the centre while the right rail stays fixed.
  Back returns to Trip home. Sending from the Trip home composer starts a new Chat linked to the
  Trip and opens it.
- Suggestions come from the current Plan. Choosing one sends it into a linked Chat. Dismissal is
  remembered for the Trip until the Plan changes.
- At phone width, order the page as title and facts, suggestion, five actions, Chats, map and
  composer. Keep one page scroll region.

The complete interaction and acceptance specification is
[Trip home action rail](../../../../docs/design/trip-home-actions.md).

## Alternatives considered

- **Keep the current three cards below Chats and add only a return path from Calendar.** This fixes
  one interruption but leaves the other actions leaving Trip home and keeps plan actions away from
  the map.
- **Use a single tabbed Trip panel.** It avoids several entry points, but the traveller loses the
  visible Chat and map context that the Trip home is meant to preserve.
- **Add a Media card to match the reference screenshot.** It has no product model, stored content or
  creation flow, so it would be an empty control.
- **Use the global Trips calendar inside the drawer.** It shows unrelated Trips, while this action
  is about the open Trip's days and itinerary.

## Acceptance criteria

- A Trip with two Chats shows both, opens the selected Chat in the centre, and restores Trip home
  on Back.
- Sending from Trip home creates one new Chat linked to the same Trip and opens it.
- Each action opens in place with correct content and one-at-a-time state.
- Desktop keeps the main column visible; phone uses a full-screen right drawer. Close, Escape and
  outside press restore focus.
- Calendar shows only the open Trip, and a chosen day opens the corresponding Itinerary day and
  map focus.
- Suggestions send into a linked Chat and stay dismissed across reload until the Plan changes.
- Fixture E2E covers desktop, tablet and phone in English and Chinese, keyboard use, zoom and no
  horizontal overflow.

## Risks

- The main column, five cards and map can compete for width at tablet sizes; the phone order and
  breakpoint crossings need explicit layout tests.
- Reusing TripPanel, Ideas, BookingRow and preference editors inside drawers can duplicate state or
  update paths. They should share the existing plan and draft owners.
- Calendar-to-Itinerary switching needs deterministic day and stop focus without leaving a stale
  drawer or losing keyboard position.
- The existing `layout` reducer supports one drawer kind but not these five actions; adding them
  without extending that owner would repeat the earlier competing-open-panel defect.

## Sources

- The repository owner supplied screenshots of the current Trip home and a Mindtrip Trip page and
  approved the design on 2026-10-29.
- [Trip home page](../../implemented/feature/2026-10-28-trip-home-page.md)
- [Trip home page shell](../../implemented/feature/2026-10-28-trip-home-shell.md)
- [Trip home lists the trip's chats](../../implemented/feature/2026-10-28-trip-home-chats.md)
- [Session log](../../../session-logs/2026-10-29-trip-home-action-rail.md)
