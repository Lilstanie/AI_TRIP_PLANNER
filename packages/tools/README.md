# @trip/tools

The tool gateway and every external data adapter: maps, places and routes, hotels and flights, and
weather. Agents reach providers only through the `ToolGateway` built here. Owners: A (gateway and
data mode), B (maps and routes), C (booking and SerpApi), D (weather).

## Modules

| Module             | Purpose                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| `gateway.ts`       | `createToolGateway()`: the `maps`, `booking` and `weather` ports for one planning run   |
| `data-mode.ts`     | Per-request mock or live mode (`mockEnabled()`, `runWithDataMode()`, `parseDataMode()`) |
| `maps.ts`          | Places and routes through OpenStreetMap (Nominatim, OSRM) or Google, or fixtures        |
| `route-options.ts` | Drive and transit options for one hop, compared side by side                            |
| `google-places.ts` | Shared Google Places `searchText` request                                               |
| `booking.ts`       | Hotels and flights: SerpApi, then a Google Places estimate for hotels, or fixtures      |
| `serpapi.ts`       | SerpApi Google Hotels and Google Flights with a shared monthly quota and cache          |
| `airports.ts`      | City to IATA code lookup for flight searches                                            |
| `weather.ts`       | `WeatherPort`: Google Weather, Open-Meteo or climate context by date distance           |
| `mock-server.mjs`  | Optional stub HTTP server (`pnpm mock-server`); the app never calls it                  |

## Configuration

`USE_MOCK_TOOLS` sets the default mode; a request can override it with the `x-trip-data-mode`
header. Live mode reads `MAPS_PROVIDER`, `MAPS_API_KEY`, `OSM_USER_AGENT`, `NOMINATIM_BASE_URL`,
`OSRM_BASE_URL`, `MAPS_API_BASE_URL`, `SERPAPI_KEY` and `WEATHER_API_KEY`. Each is described in
[`.env.example`](../../.env.example) and [development.md](../../docs/development.md#environment-variables).

## Contracts

- Mock mode makes no network calls and returns the same types as live mode.
- Call `mockEnabled()`; never read `process.env.USE_MOCK_TOOLS` directly
  ([data mode note](../../.agents/notes/implemented/feature/2026-09-21-request-scoped-data-mode.md)).
- Amounts are AUD. Stay prices are per room per night; flight prices are for all passengers.
- Ratings are on a 0–10 scale; provider ratings on 1–5 are doubled.
- Failures raise typed errors (`SerpApiError.reason`) and fall back only to a labelled tier; a flight
  is never given an invented fare. See the [SerpApi](../../.agents/notes/implemented/feature/2026-09-20-serpapi-live-prices.md),
  [Google Places](../../.agents/notes/implemented/feature/2026-09-20-google-places-hotels.md) and
  [weather](../../.agents/notes/implemented/feature/2026-09-21-weather-forecast-horizon.md) notes.
- Adding a provider follows the [add-provider skill](../../.agents/skills/add-provider/SKILL.md).

## Tests

`pnpm --filter @trip/tools test`. Tests stub `fetch`; none needs a key or spends provider quota.
