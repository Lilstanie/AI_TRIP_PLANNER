# One-day trips: failure inventory

Written before the code (#539). A traveller asks for a single day in one place. Joey chose to allow a
same-day trip when it has one destination and books no accommodation. Each line is a way the change
could fail.

- "1 day in Sydney from 14 Dec 2026" still asks for a second day, or refuses to plan.
- The plan spreads stops over a second day, or a stop has no day.
- A stay, a hotel cost or a nightly figure appears in the plan or its total.
- The trip details say "0 days", "2 days" or "1 nights" instead of "1 day".
- Asking for one day and keeping accommodation explicitly on is accepted silently instead of being
  refused with a reason.
- Two destinations on the same day are accepted, although each destination still needs a night.
- An end date before the start date is accepted.
- Multi-day trips change: a 3-day trip loses its stay or a day.
- The Chinese interface shows English text for the one-day trip.
