# Agent Note: One Itinerary for stop numbers, visiting order and the Trip badge

Status: implemented
Owner: repository owner (@HeadmasterEggy)

## Problem

Each view of a trip worked out its own stops. The desktop timeline numbered a day's stops 1, 2, 3
while the map beside it numbered the same stops 4, 5, 6. A place visited twice was numbered on the
phone map but not in the trip list. The Trip button counted ideas (activities without a day) as if
they were stops. When start times disagreed with the plan's order, the timeline listed a day in plan
order while the map and trip list used start time. Each rule lived in several callers
(`itineraryOrder`, `firstVisits`, `activityForPlace`, the timeline's own counter), and the phone
bugs #185 and #186 were each fixed in one caller only.

## Decision

- `apps/web/lib/trip/itinerary.ts` is a pure module. `buildItinerary(plan, placeFor)` takes a plan
  and a function returning the place already looked up for an activity; it performs no lookups.
  Lookups stay in `components/map/useTripPlaces.ts`, which exposes the result as
  `tripPlaces.itinerary`.
- Interface: `days()`, `stopsOn(day)`, `ideas()`, `stopCount`, `markersFor(day?)`, plus
  `stop(activityId)` and `planIndex(activityId, day, position)`.
- A **stop** is an itinerary activity with a day. An **idea** has no day and is never counted,
  numbered or mapped.
- **Visiting order** everywhere: day, then start time, then position in the plan.
- **Stop numbers** are trip-wide: one per located place, given in visiting order, and a place
  visited again keeps its first number. A stop whose place is not located has no number. The desktop
  map, phone map, trip list and timeline all show this number; the timeline's per-day counter is
  gone.
- `markersFor()` is the whole-trip map (one marker per place, at its first visit); `markersFor(day)`
  is that day's map, so a place first seen on an earlier day is still drawn on the later day (#185).
- The Trip button badge shows `stopCount`, so ideas no longer inflate it.
- The edit preview endpoint (`POST /api/trip/preview-edit`) is unchanged and still indexes the day's
  other stops in plan order. Timeline moves name a position as shown, and `planIndex` translates it
  into the index the endpoint needs. The endpoint inserts in plan order and re-times the day from
  the inserted stop, so `planIndex` anchors a move on the neighbour the traveller moved past: a
  stop moved later on its own day goes just after the stop shown above the target, any other move
  just before the stop shown at the target, and the end of the day after every other stop (#202).

## Alternatives considered

Both were weighed in the design interview for spec #196 (questions Q4 and Q5):

- **Keep per-view numbering, the earlier behaviour.** The timeline numbered stops per day while the
  maps numbered them across the trip. Rejected because a traveller could not match a pin to a row,
  which is the confusion the spec set out to remove.
- **Change the preview endpoint to index visiting order.** Rejected to keep the API contract and its
  server tests untouched; the translation is one function in the Itinerary.

## Consequences

- Every view agrees by construction, and day, numbering and ordering rules are tested without a
  browser in `apps/web/tests/lib/trip/itinerary.test.ts`, which also runs Move earlier and Move
  later through the real `previewEdit` (start times out of plan order, first and last stops, a
  repeat visit).
- The Trip badge is smaller for plans with ideas, and a timeline day can start at a number other
  than 1. Both are intended behaviour changes.
- `itineraryOrder`, `firstVisits`, `activityForPlace`, `TripMarker` and `markers`/`visits` on
  `TripPlaces` are removed; `lib/map/itinerary-route.ts` now only draws lines from stops already in
  visiting order. `visitingOrder` is exported for the trip list's swap action.
- `planIndex` must stay in step with how `lib/trip/trip-edit.ts` reads a move's `index`; a change to
  the endpoint's indexing needs a matching change here.
- This partly refines the itinerary line rule in the
  [location prompt and itinerary map note](../feature/2026-09-24-location-prompt-and-itinerary-map.md).

## Sources

- Spec #196 and tickets #197 and #202.
- Session logs `.agents/session-logs/2026-10-06-itinerary-module.md` and
  `.agents/session-logs/2026-10-06-itinerary-timeline.md`.
