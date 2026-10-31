# Agent Note: the return day ends before the return flight

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

A live packed Tokyo trip on 2026-10-31 planned six sights on the last day until 19:00, while the
plan's own note said the return day had no activities. Nothing in the itinerary read the return
leg, so the last day was planned like any other.

## Decision

- `inboundDeparture(brief, proposals)` in `packages/shared/src/arrival.ts` returns the day and time
  the selected `flight-0` fare's return leg departs (its first inbound segment). It sits beside
  `outboundArrival` for the same reason: one parser shared by every package, including the web
  client bundle.
- The itinerary adds a transfer window from the last city on that day, starting three hours before
  the flight (`departureWindow`), so the existing transfer checks keep stops, meals and the fallback
  out of it. A flight leaving before 13:30 blocks the whole day, and that day no longer counts as
  missing.
- The model is told the departure, and the proposal notes it (`departureNote`).

## Alternatives considered

**Trim stops after the draft.** It hides the cut from the model, which then keeps planning late
stops; the transfer window makes a late stop a validation error that the retry can fix.

**A separate departure check beside `beforeLanding`.** It would duplicate what transfer windows
already do for intercity hops.

## Consequences

- `packages/shared` gains one pure function and the `InboundDeparture` type; no existing type
  changes.
- The return leg is known only when the transport agent fetched it (`searchReturnLeg`, PR #865);
  without it the last day is planned as before.
- The three-hour check-in margin is fixed; it does not know the airport.
