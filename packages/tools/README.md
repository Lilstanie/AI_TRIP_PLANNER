# @trip/tools

The tool gateway and every external data adapter: maps, places and routes, hotels and flights, and
weather. Agents reach providers only through the `ToolGateway` built here. Owners: A (gateway and
data mode), B (maps and routes), C (booking and SerpApi), D (weather).

## Modules

| Module                | Purpose                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `gateway.ts`          | `createToolGateway()`: the `maps`, `booking` and `weather` ports for one planning run   |
| `gateway-internal.ts` | Internal deterministic gateway construction for provider-policy E2E coverage            |
| `runtime-context.ts`  | Immutable per-gateway provider configuration, network dependency and clock              |
| `data-mode.ts`        | Per-request mock or live mode (`mockEnabled()`, `runWithDataMode()`, `parseDataMode()`) |
| `maps-port.ts`        | Deep Maps port selecting fixtures, OpenStreetMap or Google once per gateway             |
| `maps.ts`             | Temporary direct-adapter compatibility surface pending issue #131                       |
| `booking-port.ts`     | Deep Booking port selecting fixtures, SerpApi or Google estimates once per gateway      |
| `route-options.ts`    | Drive and transit options for one hop, compared side by side                            |
| `google-places.ts`    | Shared Google Places `searchText` request                                               |
| `booking.ts`          | Temporary direct-adapter compatibility surface pending issue #131                       |
| `serpapi.ts`          | SerpApi Google Hotels and Google Flights with a shared monthly quota and cache          |
| `airports.ts`         | City to IATA code lookup for flight searches                                            |
| `weather-port.ts`     | Deep Weather port selecting fixture, Google Weather, Open-Meteo forecast or archive     |
| `weather.ts`          | Temporary direct-adapter compatibility surface pending issue #131                       |
| `mock-server.mjs`     | Optional stub HTTP server (`pnpm mock-server`); the app never calls it                  |

## Configuration

`USE_MOCK_TOOLS` sets the default mode; a request can override it with the `x-trip-data-mode`
header. Gateway creation snapshots `MAPS_PROVIDER`, `MAPS_API_KEY`, `OSM_USER_AGENT`,
`NOMINATIM_BASE_URL`, `OSRM_BASE_URL`, `MAPS_API_BASE_URL`, `SERPAPI_KEY` and `WEATHER_API_KEY` once
for the Planning Run; changing process environment later cannot switch that gateway's policy. Each is described in
[`.env.example`](../../.env.example) and [development.md](../../docs/development.md#environment-variables).

The Maps port owns provider capabilities and fallback policy. Google supplies routes, places and
concurrent route options; OpenStreetMap supplies Nominatim places plus OSRM driving estimates and
rejects unsupported route options only when called. Google transit-to-driving and inter-city
SerpApi rail fallback decisions remain internal to the port.

The Booking port owns hotel and flight provider selection. Fixture mode stays deterministic;
live hotel searches use SerpApi first and fall back to a labelled Google Places estimate, while
live flights remain SerpApi-only and never substitute a fictional fare. Missing credentials and
unsupported capabilities fail only when the corresponding method is called.

The Weather port uses the gateway's captured mode, credentials and clock. Fixture mode is
deterministic and makes no network request. Live dates 0–10 days away use Google Weather, dates
11–14 days away use Open-Meteo forecast, and later dates use three years of Open-Meteo historical
archive as climate context. A missing Google Weather key fails only when a near-date forecast is
requested; provider errors are returned to the destination specialist for its existing unavailable
weather path.

## Contracts

- Mock mode makes no network calls and returns the same types as live mode.
- Deep ports use the request-scoped mode captured in `ToolRuntimeConfig`; temporary direct
  compatibility adapters obtain the same mode through `snapshotToolRuntime()`. Provider code never
  reads `process.env.USE_MOCK_TOOLS` directly ([data mode note](../../.agents/notes/implemented/feature/2026-09-21-request-scoped-data-mode.md)).
- Amounts are AUD. Stay prices are per room per night; flight prices are for all passengers.
- Ratings are on a 0–10 scale; provider ratings on 1–5 are doubled.
- Failures raise typed errors (`SerpApiError.reason`) and fall back only to a labelled tier; a flight
  is never given an invented fare. See the [SerpApi](../../.agents/notes/implemented/feature/2026-09-20-serpapi-live-prices.md),
  [Google Places](../../.agents/notes/implemented/feature/2026-09-20-google-places-hotels.md) and
  [weather](../../.agents/notes/implemented/feature/2026-09-21-weather-forecast-horizon.md) notes.
- Adding a provider follows the [add-provider skill](../../.agents/skills/add-provider/SKILL.md).

## Tests

`pnpm --filter @trip/tools test`. Tests stub `fetch`; none needs a key or spends provider quota. The
provider matrix exercises the public gateway ports with injected configuration, network and time,
then writes its reviewable summary to `output/e2e/tool-gateway-provider-matrix/summary.json`.
