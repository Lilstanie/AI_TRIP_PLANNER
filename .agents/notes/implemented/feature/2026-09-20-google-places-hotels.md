# Agent Note: Ground hotels in Google Places with estimated prices

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

In live mode, restaurants and attractions came from Google Places but `BookingPort.searchStays()`
had no real-data path, so every hotel was a mock fixture. Google Places reports real properties but
no nightly rates, and its ratings use a different scale from this project.

## Decision

When SerpApi is unavailable, live hotel search calls Google Places `searchText` for
`"hotels in {city}"` through `packages/tools/src/google-places.ts` and maps results to
`StayCandidate`:

- Ratings are converted from Google's 1–5 scale to the project's 0–10 scale (4.6 → 9.2), with a
  test, because every rating rule assumes 0–10 and Zod would accept the unconverted value.
- The nightly price is estimated from `price_level` (AUD 135 / 225 / 390 / 630 by bucket) and
  labelled as an estimate, never a quote.
- `freeCancellation` is `false` because Places does not report a cancellation policy.
- The optional `grounded` flag on stays tells a real property from a fixture through the port's
  return value, so agents never reach around the port to ask `@trip/tools`.

## Alternatives considered

**A paid hotel-pricing API such as Amadeus.** Rejected at the time: it needs a personal account
sign-up. SerpApi later became the first tier; see
[SerpApi live prices](2026-09-20-serpapi-live-prices.md).

**Pass Google's rating through unchanged.** Rejected: it silently misjudges every real hotel while
still passing schema validation.

**Assume free cancellation.** Rejected: a traveller who requires it could be placed in a hotel whose
policy nobody checked.

## Consequences

- Budgets built on estimated prices are approximate; the UI shows the source kind so users can
  tell. See [source kind](../bug-fix/2026-09-21-proposal-source-kind.md).
- Adding `grounded` was an additive change to `packages/shared`.

## Sources

[2026-09-20 real places data log](../../../session-logs/2026-09-20-claude-real-places-data.md)
