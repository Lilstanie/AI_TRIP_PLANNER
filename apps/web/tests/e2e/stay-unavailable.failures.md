# Stay unavailable: failure inventory

Written before the code. Each line is a way an accommodation section with no searchable stays could
fail. The seam is the real Trip workspace in a browser, in Live data, with `MAPS_PROVIDER=osm`, no
`SERPAPI_KEY`, no model keys and every OSM upstream pointed at a local stub, so the booking port
rejects every stay search exactly as it does in that deployment.

## Planning

- The stay search rejection escapes the accommodation specialist and the whole plan fails with
  "Unable to update this trip" (the reported bug).
- A city whose search succeeds but returns no stay that meets the confirmed preferences still throws
  "No valid stays" and fails the whole plan.
- The specialist catches the rejection but also swallows a cancelled request, so a stopped plan keeps
  running.
- One failed city discards the priced stays of the other cities in a multi-city trip.
- With a model configured, the model is asked to choose a candidate for a city that has none, rejects
  the turn, and the section falls back for the wrong reason.
- Transport, Day plan, Meals or Guide do not finish because accommodation failed.
- The degraded section is retried on every revision round without limit.

## Truthfulness

- The section reports source `live`, `estimated`, `mock` or `fallback` when no stay was searched.
- An unpriced night is given an invented nightly rate, or a cost of 0 that reads as free.
- The section's assumptions describe mock or live rates that were never fetched.
- The tool-level rejection (`Unsupported booking provider: osm`) is removed from the gateway, so the
  failure is hidden one layer lower.

## What the traveller sees

- The budget card reads "Within budget" with no unpriced count, or Accommodation shows AUD 0 instead
  of "Not costed".
- The Stays row for the city is missing, shows a price, or loses its night count.
- The trip-home calendar shows no stay bar for the unpriced nights, or the wrong number of nights.
- "To check" does not list the unpriced stay, or lists a stay the traveller booked themselves.
- The open conflict text is missing from the budget card, or appears only in English in Chinese.

## Agent Lab

- The accommodation section counts as a grounded section in the metrics.
- The stay-date checks fail because the unpriced row no longer states its dates and nights.
- The run reports a failed agent instead of an unresolved conflict.
