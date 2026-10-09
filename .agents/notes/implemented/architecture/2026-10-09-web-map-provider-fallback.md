# Agent Note: Google first, with an automatic OpenStreetMap fallback, behind one web map provider

Status: implemented

## Problem

The web workspace's place search, place details, place photos, leg routes, route from the
traveller's location and destination time zone all called Google Maps Platform directly from
`apps/web/lib/integrations/google.ts`. When Google was not configured, or answered that the API was
disabled, billing was off or the quota was exhausted, every one of those features failed: no saved
places, no photos, no leg times, no time zone. The team could not demo the product while the Google
key was not working. The planning agents already have a free OpenStreetMap path in
`packages/tools` (`MAPS_PROVIDER=osm`), but the web routes had no seam to put one behind.

Spec #270 asks for Google to stay the default and for free OpenStreetMap-based services to answer
automatically whenever Google cannot.

## Decision

Every web-side map call goes through one `MapProvider` interface in
`apps/web/lib/map-provider/` (`types.ts`). It has six operations: `searchPlaces`, `placeDetails`,
`placePhoto`, `route`, `routeFromLocation` and `timeZone`. Each answer names the provider that gave
it (`Answered<T>.source`, or `RouteResult.source` for routes), as `"google"` or `"osm"`.

- **Google** (`google.ts`) holds today's code from `lib/integrations/google.ts`, unchanged in what it
  asks Google and how it reads the answer.
- **OSM** (`osm.ts`) is the free provider. Until tickets #272–#277 fill it in, every operation
  reports itself unavailable, so a traveller sees the same Google failures as before.
- **Fallback** (`fallback.ts`) wraps the two. It calls Google first and calls OSM only when Google is
  _unavailable_: not configured; access denied, API disabled, billing off, an invalid key or quota
  exhausted (HTTP 401, 403, 429, a 400 whose reason is `API_KEY_INVALID`, or a Time Zone status of
  `REQUEST_DENIED`, `OVER_QUERY_LIMIT` or `OVER_DAILY_LIMIT`); a Google server error (5xx); a timeout
  or network failure. A valid answer with no results, an unknown place (400/404) and an authored
  refusal such as a transit date out of range are answers, not outages, and never fall back. When
  OSM cannot answer either, the Google failure is what the route reports, so its notices and HTTP
  statuses stay as they were.
- After an access-denied or quota failure, the fallback skips Google for a cool-down
  (`GOOGLE_MAPS_COOLDOWN_SECONDS`, default 300) and then tries it again. Other failures do not start
  a cool-down; a missing key is detected without a request.
- Ids are provider-scoped strings: `osm:node/123`, `osm:way/456`, `osm:relation/789`; an id without a
  prefix is a Google id, as before. Details, photos and routes for an OSM id never go to Google, and a
  Google id is never sent to OSM. `packages/shared/src` does not change.
- `WEB_MAPS_PROVIDER` selects `google-with-fallback` (the default), `google` (never falls back) or
  `osm`. It is separate from the agents' `MAPS_PROVIDER`, whose `.env.example` value is `osm`; sharing
  one setting is left to review of spec #270.
- In mock data mode (the request's `x-trip-data-mode`, else `USE_MOCK_TOOLS`),
  `MOCK_GOOGLE_MAPS=unavailable` makes the Google provider fail as unavailable without calling Google,
  so E2E can drive the fallback path. The switch is ignored in live mode.

The browser-facing routes keep their paths and response shapes: `/api/places/search` and
`/api/places/details` gain a `source` field, `/api/places/photo` an `X-Map-Provider` header on its
redirect, and route results a `source` field. The server check (`/api/trip/preview-edit`) asks the
same provider through `LIVE_EDIT_DEPS` (`route`, `placeDetails`, `timeZone`).

## Alternatives considered

- **OSM as the default, Google optional.** The first draft of spec #270. Joey revised it on
  2026-10-09: Google stays the default because its places, ratings and transit data are richer.
- **Fall back on any Google error.** Rejected: an empty search or an unknown place would then be
  answered by a different provider, mixing results and hiding real "not found" answers.
- **Try Google on every request even after a quota or access error.** Rejected: each request would
  wait on a failure already known, and a disabled API stays disabled for longer than one request.
- **Reuse `MAPS_PROVIDER`.** Deferred, not rejected: its current example value `osm` would silently
  switch the web workspace off Google.

## Consequences

- Later tickets add OSM search and details (#272), photos (#275), OSRM routes and an offline time
  zone (#273) and Transitous (#276) as methods of `osm.ts`, without reshaping routes or callers.
- During a cool-down with no OSM answer, the traveller sees the failure that started the cool-down
  for up to five minutes, even if Google recovers sooner.
- The cool-down lives in server memory; each server instance learns Google's state on its own and a
  restart clears it.
- The free services have their own limits and terms, recorded in
  [architecture.md](../../../../docs/architecture.md); the public OSRM demo and Transitous are for
  non-commercial use only.

## Sources

- GitHub issues #270 (spec) and #271 (this seam).
