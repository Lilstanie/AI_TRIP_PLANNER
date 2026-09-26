# Agent Note: Inter-city rail from Google Maps directions through SerpApi

Status: implemented
Owner: C (@HeadmasterEggy)

## Problem

Google's Routes API returns no transit in Japan, so an inter-city hop such as Tokyo → Kyoto fell
back to a 336-minute drive with no fare. The missing fare raised a transport conflict no revision
could fix, so every Tokyo & Kyoto plan ran all three rounds and ended with "Transport fare
unavailable", while the real journey is a 2 h 10 min Shinkansen.

A single SerpApi `google_maps_directions` query (`travel_mode=3`, Tokyo Station → Kyoto Station,
2026-09-26) returned "Tokaido Shinkansen Nozomi", 7800 s, `cost` 14170 and `currency` "JPY".

## Decision

- `RouteQuery` (`packages/shared/src/ports.ts`) gains two optional fields: `intercity` marks a hop
  between trip cities, and `passengers` is the group size to price it for. Transport's ground hops
  set both; the itinerary's hops between stops set neither.
- `packages/tools/src/maps.ts` `route()` asks `searchTransitSerpApi` (`serpapi.ts`) only for an
  `intercity` hop whose Google transit answer is empty or too slow, before the driving fallback.
  The lookup shares SerpApi's monthly quota and 15-minute cache with hotels and flights.
- The leg's `durationMin` is SerpApi's; the fare is `cost` in a `SUPPORTED_CURRENCIES` currency,
  converted with the static `AUD_PER` table and multiplied by `passengers`. The mode is `train`
  when a trip names a train or Shinkansen, otherwise `transit`. The note names the service and the
  original fare per person.
- Every SerpApi failure (no key, quota, no route, unknown currency, network) falls through to the
  existing driving fallback; a fare in an unsupported currency keeps the leg unpriced rather than
  guessing a rate. Mock mode never calls SerpApi.

Ways this can fail, written before the code and each handled above: SerpApi not configured; key
rejected; monthly quota reached; HTTP or network failure; no directions; a direction without
`duration`; `cost` absent, zero or non-numeric; a currency outside `SUPPORTED_CURRENCIES`;
`passengers` absent (priced for one); an itinerary hop spending quota (prevented by `intercity`).

## Alternatives considered

**NAVITIME Route API.** Covers Japanese rail with fares, but needs a new vendor account and key;
SerpApi is already configured and returned the Shinkansen and its fare.

**Ekispert.** The free plan returns only a link to its website; the standard plan needs a sales
contract.

**ODPT open data.** Free, but its JR East data excludes the Shinkansen and JR Central is not covered.

## Consequences

- Tokyo → Kyoto becomes a priced Shinkansen leg, so the unfixable fare conflict and its wasted
  revision rounds go away.
- Each uncached inter-city hop in a country without Google transit data costs one SerpApi search
  from the shared 230-a-month allowance.
- The fare is converted at the static, approximate JPY rate, like every other non-AUD amount.
- The departure time is not sent, so the service shown is whichever SerpApi returns for now; the
  duration and fare of a scheduled line are stable, the exact train is not.

## Sources

- [SerpApi Google Maps Directions API](https://serpapi.com/google-maps-directions-api)
- [AUD base currency](../architecture/2026-09-20-aud-base-currency.md)
- [SerpApi live prices](2026-09-20-serpapi-live-prices.md)
