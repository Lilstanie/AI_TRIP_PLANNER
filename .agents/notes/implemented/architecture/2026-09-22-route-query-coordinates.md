# Agent Note: a route query carries where its places are

Status: implemented
Owner: A (@Lilstanie)

## Problem

`RouteQuery` identified both ends of a hop by name alone, and every provider path resolved those
names against the whole world: Google's `computeRoutes` took `{ address }`, the OSM path geocoded
through Nominatim, and the Google time-zone lookup searched the origin's name a third time. A place
name is not unique — a landmark in one city is a street in another — so a geocoder could answer with
a namesake on another continent. Two stops a short walk apart then came back with no route between
them, which the itinerary reported as a geography conflict: a provider's ambiguity presented to the
traveller as a fact about their trip.

The Places search had already returned the exact coordinates of every one of those places. The
planner held them, used them for nothing, and asked the provider to guess the same answer back.

## Decision

`RouteQuery` gains optional `fromLocation` / `toLocation`, typed as a new exported `GeoPoint`
(`Place.location` is now the same type, unchanged in shape). The names stay: they are what a
traveller reads in a route note, and `from`/`to` remain required. The coordinates say only *which*
place is meant.

Providers prefer them and fall back to the name when they are absent or out of range — a hint, not a
second code path. `packages/agents/src/itinerary` supplies them from the place candidates it already
holds, keyed by the same normalised name `validateDraft` uses to prove an activity is grounded.

## Alternatives considered

**Qualify the name with the city — `"Circular Quay, Sydney"`.** No contract change and one line per
call site, but it narrows the guess instead of removing it, still spends a geocode, and does nothing
for the duplicate-name case inside one city.

**Replace `from: string` with a `RoutePoint` object.** Structurally cleaner, but it breaks every
caller and test for a field that is optional by nature, and the provider notes would have to re-derive
the display name they already had.

**Pass Google's `placeId`.** Higher fidelity than coordinates, but it is one provider's identifier in
a port two providers implement, and `Place` does not carry it today.

## Consequences

- A caller with coordinates saves a Places search per route: the origin time zone is resolved from
  the point itself, removing a lookup that could fail or answer for the wrong city.
- Callers without them are unaffected. Inter-city hops in `packages/agents/src/transport` name cities
  and still geocode; city names are far less ambiguous, and no `Place` exists for them to resolve.
- An out-of-range coordinate is treated as absent rather than as an error, so bad input degrades to
  today's behaviour instead of failing the whole route.
