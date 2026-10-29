# Agent Note: Compare arrival flights using destination-local time

Status: implemented
Owner: B (@fonever2)

## Problem

The selected arrival flight carried provider segments, but the conflict check only considered timed proposal items. A destination activity could be scheduled before landing, especially for an overnight flight.

## Decision

The transport agent retains the selected candidate index. When both provider times fit the same departure day, the flight item exposes their local clock values. The orchestrator checks destination activities against the selected first flight's destination-local arrival date and time and requests itinerary revision for activities before landing. Missing or malformed arrival times remain unknown.

## Alternatives considered

Comparing departure and arrival clocks as if they shared one time zone was rejected: provider segment times are local to their respective airports, as documented in [flight itineraries](../architecture/2026-09-22-flight-itineraries.md).

## Consequences

Overnight arrivals can trigger itinerary revision without a fabricated start time. Self-arranged flights and fares without usable segments cannot establish an arrival conflict. The check uses the selected outbound flight and does not infer return-flight or airport-transfer times.
