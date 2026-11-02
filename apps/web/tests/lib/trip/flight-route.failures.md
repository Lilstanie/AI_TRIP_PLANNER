# Flight route label failure inventory

Written before the calendar and the day timeline shared one flight route label.

- The return flight on the last day reads like the outbound flight ("Perth → Bali" on the way home).
- The outbound flight is reversed instead.
- The day timeline and the calendar label the same return flight differently.
- A stay or night row is labelled as a flight route.

Evidence: `flight-route.test.ts` checks the label for the outbound and return roles; the calendar and
`BookingRow` both call `flightRoute`, so they cannot drift apart.
