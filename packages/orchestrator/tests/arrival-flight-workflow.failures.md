# Arrival flight conflict failure modes

- A selected timed flight loses its own provider departure or arrival data before conflict detection.
- An arrival-day activity before landing is not identified as a time conflict for itinerary revision.
- An activity after landing is incorrectly treated as a conflict.
- Flights departing and arriving on different local dates use the wrong itinerary day or compare different airport local clocks as if they were in the same zone.
- Missing, malformed, or incomplete provider times are guessed or presented as confirmed.
- Two fares with the same carrier and price attach the times of the wrong selection.
- Traveller-arranged flights without provided times gain invented times.
- A revision or budget-driven selection retains times from a previous fare.
- A date outside the trip creates an invalid day or loses the correct conflict target.
