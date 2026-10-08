# Agent Note: One day view in the Trip drawer

Status: implemented
Owner: spec #233, ticket #238

## Problem

The Trip drawer had two tabs for the same stops. "Itinerary" listed each day's stops with a "…" menu, and
"Timeline & routes" showed the chosen day with a large stop editor. A traveller had to switch tabs to move a
stop, change its time or see its routes, and the two views disagreed on what a stop could do.

## Decision

The Trip drawer shows one view: the budget summary, the day strip, the chosen day's stops in visiting order
with their trip-wide stop numbers, Ideas at the bottom, then the trip sections (flights, stays, fares) and
Review plan. The phone Trip tab renders the same component tree. The tabs and the large stop editor are gone.

- Selecting a stop (in the drawer or on the map) jumps the drawer to its day and opens a compact place card
  (`stop-place-card`): the place photo, rating, address and an Open in Google Maps link, through the existing
  `PlacePreview`. A stop without a confirmed place shows "Find this place" search in the card.
- Tapping a stop's time opens a Start/End form. Submitting it sends the time to `POST /api/trip/preview-edit`
  and applies at once (#235).
- The stop's "…" menu holds Move earlier, Move later, Move to another day, Move to ideas, Replace place,
  Edit details, Add or edit note, Mark as booked and Remove. Ideas offer Schedule on a day instead of the moves.
- Replace place opens the place search in the card. A picked result is saved through the server check.
- Drag to reorder still works on desktop.

## Alternatives considered

- Keep both tabs and only restyle them: rejected. The spec asks for one view, and the tabs keep two places
  where a stop can be edited.
- Keep the large stop editor under a selected stop: rejected by the spec. The place card replaces it, and the
  time form opens only when the time is tapped.
- Put Ideas above the day: rejected by the spec, which puts Ideas at the bottom.
- Drop the trip sections from the drawer: rejected. Stay and fare choices (`useChooseCandidate`) would have no
  surface. They sit after Ideas.
- Send every move through `preview-edit`: rejected for this change. The server refuses any day with an
  unconfirmed stop, so moves on mock or partly planned days would fail. The Itinerary list already applied
  moves in the browser, and that path is kept.

## Consequences

- Moves (earlier, later, to another day, to ideas) apply in the browser through `applyItemAction`
  (`lib/trip/item-actions.ts`). Only time and place changes go through the server check. Moves do not re-check
  routes; the Timeline's route check does.
- A place change is exempt from the "confirm the place for every stop first" blocker in
  `lib/trip/trip-edit.ts`. Without the exemption, confirming a place on a day with two unconfirmed stops could
  never succeed. Other edits on such a day are still refused.
- The card class is `stop-place-card`. `.stop-card` collides with the glass.css rules for the where fields.
- The catalog field `editorView` stays in `lib/workspace/catalog.ts` although no tab writes it.
- Tests: `apps/web/tests/e2e/timeline.e2e.mjs` and `itinerary.e2e.mjs` drive this view at 390x844 and
  360x800 and write `output/playwright/*/summary.json`.
