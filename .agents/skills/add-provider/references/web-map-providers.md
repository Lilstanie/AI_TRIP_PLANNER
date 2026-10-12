# Web map provider checklist

Use the existing `MapProvider` in `apps/web/lib/map-provider/types.ts` and selection in `index.ts`.
Read `osm-places.ts`, `fallback.ts`, `http.ts`, `osrm.ts`, `transitous.ts` and the relevant thin API
route before changing an adapter. This checklist records current merged behavior, including PR #278
and the [review fixes](../../../notes/implemented/architecture/2026-10-10-map-fallback-review-fixes.md).

## Search, language and cache

- Manual submitted searches and typing suggestions are different operations. The search route accepts
  `text`, optional `destination`, `language` (`en`/`zh`) and `autocomplete`. Typing sends
  `autocomplete: true`; explicit replacement search sends language and request data mode.
- Autocomplete is Photon-only. Chinese suggestions are unsupported and return an empty list;
  Photon failure also returns no suggestions. Never fall back to Nominatim for keystrokes, including
  when adding debounce. Nominatim's public policy prohibits client-side autocomplete.
- Explicit English/default search tries Photon, with `lang=en` for explicit English. Resolve the
  destination and constrain results with its bounding box. Photon failure falls back to Nominatim;
  a valid empty Photon answer stays empty. An unresolved destination stays empty rather than
  widening to an unrelated region. Explicit Chinese search uses Nominatim `accept-language=zh`.
- Details accept `language`, default English. Preserve locale through saved-ID lookups and replacement
  searches. Browser `useTripPlaces` keys search by mode/language/query/destination and refetches details
  when mode or language changes; preference suggestion caches include locale. Check EN→ZH→EN
  and mock↔live transitions so one context cannot reuse another's names or details.
- Nominatim lookup/search and Photon caches use the full URL, including language and bounds.
  `providerCache` stores successful answers for ten minutes by default, coalesces identical in-flight
  requests and retains at most 500 entries per cache. Valid empty answers can be cached; rejected
  failures cannot. Caches live in server memory, not durable/global infrastructure. Provider instances
  are scoped by Web setting, data mode and the simulated-Google-outage setting.

## IDs, saved coordinates and photos

- OSM IDs are `osm:node/123`, `osm:way/456` or `osm:relation/789`; unprefixed IDs belong to Google.
  Details and photo names go only to their issuing provider. Never query OSM using a Google ID or
  guess a replacement by name. Preserve response `source` and the photo redirect's `X-Map-Provider`.
- A saved activity may have `savedPlace` with name, address and coordinates. Preserve it across
  save/restore, moves and Undo. OSM routing can use those coordinate hints for mixed-provider trips;
  without coordinates an unavailable Google place remains unavailable. Older plans remain valid.
- Keep photos, ratings and full provider payloads out of persisted snapshots. Google photo names
  expire and must come fresh from Places. Commons images require author, license and license link;
  incomplete metadata yields no photo. Do not substitute stock/generated images or invent ratings.
- Google cards retain a category icon when no image is available. OSM cards omit the photo slot
  without a licensed image or after load failure. Keep the credit outside the image.

## Answers, failures and routes

- Google fallback means unavailable: missing configuration, denied/invalid key or API/billing access,
  exhausted quota, 5xx, timeout or network failure. Valid empty searches, ordinary unknown-place
  400/404 and authored refusals never fall back. If both providers fail, preserve the original Google
  failure. Do not silently convert an outage into a successful empty result outside the autocomplete
  exception above.
- Distinguish configuration/access failures requiring operator action from transient timeout/network/
  upstream failures that can be retried. Access/quota failures trigger a per-provider-instance,
  in-process Google cool-down (`GOOGLE_MAPS_COOLDOWN_SECONDS`, default 300); timeout/5xx do not.
  Missing configuration is detected without a request. A retry or cool-down does not repair an
  invalid key, disabled API or billing setup. Preserve typed reasons and HTTP statuses, rather than
  parsing human messages. `placeErrorResponse` checks `MapProviderUnavailableError` before its broad
  `NoticeError` ancestor, so an unavailable details lookup remains 503 instead of becoming 404.
- Walking uses `OSRM_FOOT_BASE_URL` with `foot`, driving `OSRM_BASE_URL` with `driving`, and cycling
  `OSRM_BIKE_BASE_URL` with `bike`. The shared mode `cycle` maps to Google's `BICYCLE` or OSRM's bike
  instance. The public car demo ignores requested profiles; never use it for walking or cycling.
- OSRM `NoRoute`/`NoSegment` means no route, not an outage. Malformed/missing duration, network,
  timeout and upstream failures stay unavailable with no invented time. Successful answers,
  including no-route, are cached for ten minutes; rejected failures are not cached.
- Transitous uses `/api/v6/plan`, coordinates and departure instant. Only a returned itinerary with
  a transit leg supplies a duration. Empty or walking-only results mean no route; failures never
  become guessed transit durations. Its cache is one minute, keyed by the full request URL.
  Routes name `google`, `osrm` or `transitous`; persisted `arriveBy` does not acquire a provider field.
- Offline time zones require coordinates; never assume UTC when they are missing. Simplified offline
  borders can resolve a nearby point to the neighbouring zone.

## Contact, limits and deployment

The [architecture policy snapshot](../../../../docs/architecture.md#free-services-limits-and-terms)
records operator terms; recheck operators' current policies before new deployment or volume changes.
Use configurable Photon, Nominatim, OSRM and Transitous base URLs for local stubs, self-hosting or
paid instances. Use the existing HTTP helper's eight-second timeout and identifying `OSM_USER_AGENT`
with a real project/version/contact, never a placeholder. No credentials belong in evidence.

Nominatim uses a process-wide queue with at least one second between starts and successful-answer
caching. Its one-request-per-second policy is application-wide across all users: multiple server
instances require coordinated limiting or self-hosting. No bulk/systematic queries or autocomplete.
Photon publishes no numeric cap and may throttle/block heavy use. OSRM's public car demo asks for
at most one request per second; the current client caches but does not globally throttle OSRM, so
cache alone does not establish compliance at volume. Public OSRM/FOSSGIS and Transitous deployment
terms must be checked; commercial deployment needs suitable self-hosted or paid services. Transitous
requires app/version/contact identification, consultation before heavy use, and visible data-source
credits. Preserve OpenStreetMap/ODbL, OpenFreeMap and image attribution on their relevant surfaces.

## Repeatable verification

Before implementation, list failure modes at the affected public API/browser boundaries and reuse
existing fixtures. `apps/web/tests/e2e/map-provider-http.e2e.mjs` exercises real handlers against local
upstreams, including language, destination bounds, empty versus failed responses, no Nominatim
suggestions, contact, queue/cache and transit parsing. `map-fallback.e2e.mjs` covers fixture OSM UI,
locale, saved coordinates and cycling edits; `map-provider-healthy.e2e.mjs` covers healthy Google
fixtures. Use the setup and runner commands in [development](../../../../docs/development.md#verification).
Add only missing behavioral coverage before code when implementing behavior changes.

Follow [UI verification](../../ui-verification/SKILL.md) for browser/provider evidence: record actual
provider/renderer, configuration, mode, language, assertion/skip counts and retained artifacts.
Fixture or local-stub success does not establish live-provider coverage or physical-device behavior;
opt-in live free-map evidence establishes only the tested destination, mode and time.
