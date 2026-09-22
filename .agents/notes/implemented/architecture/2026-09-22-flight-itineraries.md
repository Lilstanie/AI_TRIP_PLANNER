# Agent Note: a fare carries the flights behind it

Status: implemented
Owner: A (@Lilstanie)

## Problem

A `FlightOption` was a carrier, a price, a stop count and a duration. That is enough to rank fares
and nothing else: it cannot say which airports, at what local times, on which aircraft, or what the
way home looks like. Every flight product a traveller compares — Google Flights, Mindtrip, an
airline's own site — shows the segments, and a price with no itinerary behind it cannot be checked
against a calendar.

Round trips made the gap worse. Google Flights answers one in two steps: the first search returns
outbound options **already carrying the whole round-trip price**, and the ways home for one of them
are a second search keyed by that option's `departure_token`. A round-trip fare therefore arrives
with no return flights attached, and nothing in the contract could say so.

## Decision

`FlightSegment`, `FlightLayover` and `FlightLeg` describe a journey; `FlightOption` and
`FlightCandidate` gain optional `outbound`, `inbound` and `roundTrip`. `BookingPort` gains an
optional `searchReturnLeg`, and the SerpApi adapter implements it against `departure_token`.

Times stay the provider's own local strings. Converting them to instants needs each airport's zone,
and a departure shown in anything but the departure airport's local time is wrong on a boarding
pass and wrong here.

`inbound` absent on a `roundTrip` fare means "not looked up", not "one way" — the UI says so rather
than implying the outbound is the whole journey.

## Alternatives considered

**Fetch every return leg.** One extra search per itinerary against a 230/month allowance, for fares
nobody scrolls to. The orchestrator fetches returns for the itineraries it will show in full
(`ITINERARIES_SHOWN_IN_FULL`, currently 2).

**Normalise times to UTC.** Sortable, and wrong to read. A traveller checks a departure against the
clock at the airport they are standing in.

**Keep the flat shape and add fields.** `outboundFlightNumbers: string[]` and friends would encode
the same structure without letting a renderer walk it.

## Consequences

- Every field is optional and additive; a provider that returns only a price still satisfies both
  contracts, and mock fixtures are unchanged.
- Showing a round trip in full costs two searches, not one. That cost is per itinerary shown.
- `searchReturnLeg` is optional on the port, so an adapter that answers a round trip in one call
  needs no stub.
