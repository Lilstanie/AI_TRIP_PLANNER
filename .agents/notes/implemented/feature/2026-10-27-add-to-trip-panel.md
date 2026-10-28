# Agent Note: Add to trip panel

Status: implemented
Owner: spec #743, ticket #747
Superseded in part: the Add to Ideas button and the panel opened from Ideas, by [Ideas as an "N ideas" chip](2026-10-28-ideas-chip.md).

## Problem

[Instant itinerary edits](2026-10-27-instant-itinerary-edits.md) removed the preview from Add place, but
the form still offered one search box and a Place name field under the viewed day, and Ideas could only
be filled from there. Parked places could not be scheduled, places from the account could not be reused,
and a search could not be narrowed to stays, restaurants or events.

## Decision

- Add place is replaced by one Add to trip panel (`components/trip/timeline/AddToTripPanel.tsx`), opened
  by an Add button at the end of the viewed day (`Add to Day N`) or in Ideas (`Add to Ideas`). It adds to
  that day or to Ideas. The Ideas tab is offered only from a day.
- Tabs: Search, Ideas, Saved, Custom. No Receipt tab. A chosen place is added at once through the
  existing `add` edit, with Undo; the panel closes unless Keep open is on.
- Search sends the trip destination. The filters Places, Stays, Restaurants, Experiences and Events narrow
  results by place type on the client (`lib/trip/add-filters.ts`). A filter other than Places also sends
  its `kind` to `/api/places/search`, which appends a query word server side so the five provider results
  are of that kind.
- Saved has no account-level store of its own. It lists the `savedPlace` entries of the account's other
  trips from the workspace catalog (`lib/trip/saved-places.ts`), once per place. A saved place keeps its
  saved map match. No shared type, schema or account route was added.
- A search result with coordinates is added with its saved map match; one without, and a Custom entry,
  go through the existing automatic place save, which shows a search box on the stop only when the lookup
  fails.
- Adding a place already on the day adds a second stop, as the instant edits note decided.
- The old Add place button, Place name field and Save as Idea button, with their strings, are deleted.
  The Place name, Search Google Maps and Use strings stay for the Replace place form.

## Alternatives considered

- Filter only on the client: the provider returns five mixed results, so a filter could leave none.
- Filter only through the query: mock and fixture results carry a place type, and the query word alone
  does not narrow them.
- A dedicated saved-places store on the account: it needs a shared type or schema change and Joey's
  approval, which this ticket does not carry.

## Consequences

- Saved shows only places that were saved on a trip held in this browser or synced to the account; a
  place never added to any trip is not listed.
- Undo remains the existing single step: with Keep open, one Undo takes back the last add only.
- The `add-to-trip-panel` E2E covers every tab, the filters, Keep open, Undo, the phone viewport and Chinese;
  `instant-edits` covers the locked trip.

## Sources

- [Spec #743](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/743), ticket #747.
