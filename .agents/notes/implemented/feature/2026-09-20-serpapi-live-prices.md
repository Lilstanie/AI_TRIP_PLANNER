# Agent Note: SerpApi for live hotel and flight prices

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

Google Places gives real hotels but only estimated prices, and flights had no live pricing at all.
Real-time prices need a paid provider with a small monthly allowance shared by the whole team.

## Decision

`packages/tools/src/serpapi.ts` calls SerpApi's Google Hotels and Google Flights engines with one
`SERPAPI_KEY`, one combined limit of 230 searches per month and one 15-minute result cache. When
the durable store is configured, the monthly counter is kept there; otherwise it is in-process.
Failures raise a typed `SerpApiError` with a `reason` instead of a message to string-match.

- Hotels try SerpApi first and, on any SerpApi failure, fall back to the
  [Google Places estimate](2026-09-20-google-places-hotels.md) rather than failing the search.
- Flights have no fallback tier: a failure is thrown, and the transport agent reports the flight
  as unpriced.
- Ratings are converted to 0–10 as for Places. Flight prices are per passenger from the provider
  and converted to the project's whole-group total, with a test.

## Alternatives considered

**Fail the whole hotel search when SerpApi fails.** Rejected: a real property with an estimated
price is more useful than no hotel.

**Separate quotas per engine.** Not adopted: A asked for one combined allowance so the team has one
number to watch.

## Consequences

- Without the durable store, the counter resets on every serverless cold start, so the limit is a
  soft guard.
- Live mode lets any visitor spend the allowance; see
  [request-scoped data mode](2026-09-21-request-scoped-data-mode.md).

## Sources

[2026-09-20 SerpApi integration log](../../../session-logs/2026-09-20-claude-serpapi-integration.md)
