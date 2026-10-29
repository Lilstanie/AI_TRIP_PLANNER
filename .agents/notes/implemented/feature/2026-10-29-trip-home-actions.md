# Agent Note: Trip home actions stay in place

Status: implemented
Owner: spec #774, tickets #775–#779, #794, #795

## Problem

The current Trip home already groups the Trip's Chats and shows its map, but its Itinerary, Calendar
and Preferences cards leave the page. Calendar opens the global Trips calendar, Itinerary opens the
conversation Trip panel, and Preferences opens a fact editor. The repository owner wants the
Mindtrip arrangement: the selected Trip stays in context, its Chats occupy the centre, and five Trip
actions sit above a map on the right. Calendar is the clearest failure in the current flow because
replacing the page with the global calendar gives the traveller no obvious return.

This change extends the [Trip home page](2026-10-28-trip-home-page.md) rather than replacing its
entry points, Plan ownership or Chat links.

## Decision

- Keep Trip home as page `home` with the Trip's title, facts, Rename and Delete menu, map and all
  Chats linked by `tripId`. Do not choose one Chat merely to open the Trip.
- On desktop, put Itinerary, Ideas, Bookings, Trip preferences and Calendar above the map in a
  right rail. Put the title, facts, contextual suggestion, Chats and composer in a centred main
  column.
- Open every action in a right-side drawer without leaving Trip home. The desktop panel starts
  narrow over the rail, Expand places content beside the Trip map, and Collapse restores the narrow
  panel while keeping one map instance. In-panel tabs switch actions without closing first and keep
  expansion, Trip, Chat, selected day and unsubmitted edits. A phone drawer is full screen and has
  no Expand control. No Media entry is added until a real media model exists.
- Itinerary reuses the conversation's editable Trip view and latest Plan, including activities,
  flights, stays, pending edits, selected day or activity, unsubmitted form drafts and Undo. Changing
  either entry updates the other, Calendar and the map; the home map uses that same selected activity
  and routes. Background place saves and route checks run only while the active Chat owns the Trip.
  A day containing only transport or accommodation is not called free.
  Ideas contains unscheduled activities and restaurant suggestions. Bookings groups flights, stays
  and items marked as booked. Trip preferences reuses the existing preference editor. Calendar is a
  redesigned read-only calendar for the open Trip only; choosing a day opens Itinerary at that day
  and focuses the map.
- Drawers close through a close button, Escape or an outside press, restore the Trip home scroll
  position and return focus to the opening card. Nested editors and Settings keep their own close
  precedence. Only one action drawer is open, and its state belongs to the existing workspace layout
  reducer. Bookings keeps the non-AUD estimate notice; Flights and schedule names stay translated.
- Opening an existing Chat replaces the dashboard in the centre while the right rail stays fixed.
  Back returns to Trip home. Sending from the Trip home composer starts a new Chat linked to the
  Trip and opens it.
- Suggestions come from the current Plan. Choosing one sends it into a linked Chat. Dismissal is
  remembered for the Trip until the Plan changes.
- Trip actions, preferences and scheduling read and update the same latest Plan snapshot as the
  selected Chat. Choosing a Chat does not navigate to the global conversation workspace.
- The existing itinerary editing flow owns scheduling feedback and Undo. The desktop conversation
  retains its adjustable chat/map split.
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

## Consequences

- A Trip with two Chats shows both, opens the selected Chat in the centre, and restores Trip home
  on Back.
- Sending from Trip home creates one new Chat linked to the same Trip and opens it.
- Each action opens in place with correct content and one-at-a-time state.
- Desktop starts narrow, expands beside the map and collapses without losing Trip or edit state;
  phone uses a full-screen right drawer. Close, Escape and outside press restore focus and scroll.
  In-panel tabs switch actions without closing first.
- Calendar shows only the open Trip, and a chosen day opens the corresponding Itinerary day and
  map focus.
- Home Itinerary and the conversation Trip use one editable Plan and one Undo history. Activity,
  flight and stay rows agree between both entries, while booking-only days remain visibly booked.
- Suggestions send into a linked Chat and stay dismissed across reload until the Plan changes.
- Fixture E2E covers desktop, tablet and phone in English and Chinese, keyboard use, zoom and no
  horizontal overflow.
- Browser viewports and fixture providers do not establish physical-device or live-provider behavior.
- Trip home and its open drawer still are not restored after a full page reload.

## Sources

- The repository owner supplied screenshots of the current Trip home and a Mindtrip Trip page and
  approved the design on 2026-10-29.
- [Trip home page](2026-10-28-trip-home-page.md)
- [Trip home page shell](2026-10-28-trip-home-shell.md)
- [Trip home lists the trip's chats](2026-10-28-trip-home-chats.md)
- [Session log](../../../session-logs/2026-10-29-trip-home-action-rail.md)
- [Implementation session log](../../../session-logs/2026-10-29-trip-home-workspace.md)
