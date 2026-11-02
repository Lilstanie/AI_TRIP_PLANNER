# Agent Note: itinerary edits stay on the days they name; nights per city are a brief fact

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A live test on the deployed site (2026-11-02) showed three follow-up edits going wrong.

1. Bali, "add the Ubud rice terraces on day 3": the places search had no terrace, so both model
   drafts failed validation and the deterministic fallback replaced every day with a generic
   "Bali" stop. The reply admitted it, but the broken itinerary was saved.
2. Seoul, "make day 2 less packed and add a night market": the itinerary specialist redrafted
   every day; no night market was added. The fixed fallback sentence came back in Chinese because
   it followed the interface language, not the English message.
3. Bangkok and Chiang Mai, "only 3 days in Chiang Mai": the coordinator replanned, but no brief
   field could hold the request and the hop day is an even split, so nothing changed while the
   reply said it had.

## Decision

- `change_itinerary` takes `days` (the days the change touches) and `places` (places it adds that
  the plan lacks). `RevisionRequest.places` carries the names to the itinerary specialist, which
  searches each one as a sight before drafting, so the model can name it.
- `scopedItineraryEdit` (`packages/orchestrator/src/planning/edit-scope.ts`) runs on the edited
  itinerary and on every revision in the same turn: days outside `days` keep their earlier stops and
  conflicts, and a fallback itinerary never replaces a model-drafted one. When the edit could not be
  made, the stops are unchanged and `change_itinerary` tells the coordinator to say so.
- `TripBrief.cityNights` records nights the traveller wants in particular cities (chat field
  `nightsPerCity`). `cityStartDays` in `transport/legs.ts` turns it into hop days; unnamed cities
  share the remaining nights, and an impossible request keeps the even split. Accommodation and the
  itinerary follow the hops as before.
- The fixed fallback sentence uses the message's language (`replyLanguage`).

contract-impact: packages/shared (`TripBrief.cityNights`, `CityNights`, `RevisionRequest.places`,
`PartialTripBrief.cityNights`).

## Alternatives considered

**Search the whole change sentence as a text query.** Noisy, and it cannot tell which words are a
place.

**Let the model keep untouched days by instruction alone.** It already had "change only what the
revision asks" and rewrote every day in the Seoul run.

**Encode nights per city in the destination string.** Every consumer splits the destination on
`&`; a second meaning would break them.

## Consequences

- A whole-trip edit without `days` can still redraft every day.
- A named place found only near another city of the trip is added to the first city that returns it.
