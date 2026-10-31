# The day plan starts after the flight lands: failure inventory

Written before the code (TP-194). A live Sydney to Tokyo trip on 2026-10-30 put 浅草寺 on day 1 at
15:00, while the overnight flight landed on day 2 at 08:50, so the conflict check sent the itinerary
back to the traveller. Each line is a way the change could fail.

- The itinerary never reads the selected outbound flight, so it still plans day 1.
- An activity starts the minute the plane lands, with no time to leave the airport.
- The itinerary and the conflict check read the arrival differently (another flight, a different
  segment, the departure date), so one of them still disagrees.
- The model's draft is still required to cover every day, so a correct draft that skips the flight
  day is thrown away and the fallback is used.
- A model draft that schedules a stop before landing is accepted.
- The days in the air are reported as "incomplete" instead of as travel days.
- A late landing (after the last slot) still forces a stop that evening.
- A trip without a flight, or with flights the traveller arranged, loses day 1.
