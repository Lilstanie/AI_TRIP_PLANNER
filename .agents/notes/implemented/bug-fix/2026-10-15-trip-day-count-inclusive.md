# Agent Note: A trip's end date is its last day

Status: implemented

## Problem

`planningDays()`, dining's `tripDays()` and the web `dayCount()` and edit preview returned
`end − start`, which is the number of nights. A trip from the 21st to the 25th planned and showed four
days, so the last day, the one that carries the flight out, had no itinerary day and no tab. The quick
prompts labelled four-day trips with five-day date ranges to match.

## Decision

`TripBrief.dates` is inclusive. A trip has `end − start + 1` days and `end − start` nights. The three
day counters and the edit preview add one; accommodation keeps counting nights. The quick prompts end
on the last day, so "Sydney · 4 days" runs from day 21 to day 24. The validation floor is unchanged:
dates must still be at least one night apart. [One-day trips](../architecture/2026-10-23-one-day-trips.md) later allowed a
same-day trip for one destination without accommodation.

## Alternatives considered

- Keep `end − start` as the day count and treat the end date as the check-out day. It leaves the return
  flight, dated `dates[1]`, outside every day, and disagrees with the Dates chip and Trips page, which
  already counted `+ 1`.

## Consequences

- Plans saved before this change keep their items on days 1 to `nights`; they now show one more,
  empty, final day. No stored field changed, so no snapshot version bump.
- Any new day arithmetic over `brief.dates` must add one; nights are the only count without it.
