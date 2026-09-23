# Development environment

## Prerequisites

- Node.js 22 or newer
- pnpm 9.15.0, pinned by `packageManager`; `corepack enable` selects it
- API keys are optional for local development: mock tools and deterministic fallbacks are enabled by
  default.

## Local setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev                     # http://localhost:3000
```

Keep real credentials in `.env.local` and never commit them. Use `pnpm` only so the workspace
lockfile stays consistent.

## Code organization

The web application is grouped by responsibility instead of keeping every component and helper in
one flat directory. Put new UI in the closest feature folder under `apps/web/components/`:
`workspace`, `chat`, `trip`, `map`, `preferences`, or `ui` for shared primitives. Put browser-safe
domain logic under the matching folder in `apps/web/lib/`; external clients belong in
`apps/web/lib/integrations/`. Put all web tests under `apps/web/tests/`, mirroring the `app`,
`components`, and `lib` feature groups; shared fixtures belong in `apps/web/tests/fixtures/` and
setup belongs in `apps/web/tests/setup.ts`. The package folders use the same rule: production code
stays under `src/`, while tests belong under each package's `tests/` directory.

When a feature crosses folders, keep the public contract in the domain module and import it from
there rather than creating a new root-level convenience file. Update this section and the API docs
when a directory boundary changes.

The web UI uses Tailwind CSS v4 with source-owned shadcn primitives. Tailwind is configured through
`apps/web/postcss.config.mjs` and imported from `apps/web/app/globals.css`; v4 does not use a
traditional `tailwind.config.js` in this project. `apps/web/components.json` configures the shadcn
CLI, while generated primitives live under `apps/web/components/ui/` and use `@/lib/utils` for
`cn()`. Keep the existing semantic tokens and migrate domain CSS incrementally under
`apps/web/app/styles/`; do not replace the custom focus-managed Dialog or Drawer without preserving
their keyboard and focus behavior.

### File size and style boundaries

Keep production source files and test files at or below 1000 lines of code. When a file exceeds that
threshold, split it by responsibility instead of adding more sections to the same file. CSS files
should use domain names such as `workspace-navigation.css`, `workspace-layout.css`,
`workspace-drawers.css`, and `workspace-responsive.css`; an aggregate file may remain small and
only contain ordered `@import` statements. Preserve import order when a split separates base rules,
overlays, and responsive overrides. Existing files that already exceed the threshold are migrated
incrementally when their domain is next changed; new or substantially modified files must not grow
past the threshold without documenting the exception.

Next.js API endpoints keep the framework-required `route.ts` filename. The directory path is the
route namespace, so `app/api/chat/route.ts` maps to `/api/chat` and does not conflict with
`app/api/places/search/route.ts`. Keep these files as thin Route Handler adapters and move reusable
business logic into `apps/web/lib/` or package `src/` modules. Do not rename `route.ts` merely to
make filenames unique.

Next.js only ever reads `.env*` files from the directory it runs in (`apps/web`), never from a
monorepo root — that lookup has no config option to redirect it, and it is re-applied by the dev
server's own file watcher, so pointing it elsewhere from `next.config.mjs` does not survive `next
dev`. `pnpm install` runs `scripts/link-env.mjs` as a `postinstall` step, which creates
`apps/web/.env.local` as a symlink to the root `.env.local` when the app file does not already exist.
The script deliberately does not overwrite an existing ordinary file; if that file is kept, all
runtime credentials must be configured there. On Windows this needs Developer Mode or an elevated shell;
if the symlink can't be created you can create it by hand:

```bash
ln -s ../../.env.local apps/web/.env.local
```

## Environment variables

Every variable is described in `.env.example`. The important ones:

| Setting                                                             | Purpose                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DEEPSEEK_API_KEY`                                                  | Brief extraction from chat, all five specialists, the supervisor and chat replies. Without it a local rule parser handles extraction and agents use deterministic fallbacks.                                                                                                                     |
| `USE_MOCK_TOOLS=true` (default)                                     | In-process map and booking fixtures; no external calls.                                                                                                                                                                                                                                          |
| `USE_MOCK_TOOLS=false`                                              | Real map adapters chosen by `MAPS_PROVIDER` (`google` or `osm`). If unset, Google is used when `MAPS_API_KEY` is set, otherwise OpenStreetMap; `.env.example` sets `osm`. Booking uses SerpApi when `SERPAPI_KEY` is configured, with the existing Google Places estimate as the hotel fallback. |
| `OSM_USER_AGENT`                                                    | Required contact string for Nominatim. Replace the `contact@example.com` placeholder before real traffic or you may be rate limited.                                                                                                                                                             |
| `MAPS_API_KEY`                                                      | Server-side Google Places, Routes and Time Zone for the workspace map and edit previews.                                                                                                                                                                                                         |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Browser Google Maps JavaScript map. Without them the workspace shows a map fallback and the itinerary stays usable.                                                                                                                                                                              |
| `SERPAPI_KEY`                                                       | Shared SerpApi key for Google Hotels and Google Flights searches. It is used only when `USE_MOCK_TOOLS=false`; it does not replace Google Maps, Places, Routes or Weather APIs.                                                                                                                  |
| `WEATHER_API_KEY`                                                   | Google Weather forecasts for days 0–10; falls back to `MAPS_API_KEY`. Open-Meteo covers days 11–14 without a key.                                                                                                                                                                                |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`                              | Durable Redis REST store for chat turns, preferences, plans and SerpApi usage/cache. Without them, state is in process memory.                                                                                                                                                                   |

Google key restrictions and map behaviour are described in [workspace UI](workspace-ui.md#google-maps-configuration).
Model routing and fallbacks are described in [architecture](architecture.md#agents-and-models).

## External data provider plan

SerpApi is the provider for the project's current hotel and flight search layer. One
`SERPAPI_KEY` can be used for both SerpApi engines, but this does not make SerpApi a universal
travel backend:

| Capability                                            | Provider                                                                                             | Status and boundary                                                                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Hotel search and indicative prices                    | [SerpApi Google Hotels](https://serpapi.com/google-hotels-api)                                       | Live search results when configured; results are planning data, not a reservation or guaranteed quote.                                  |
| Flight search and indicative fares                    | [SerpApi Google Flights](https://serpapi.com/google-flights-api)                                     | Search results and fares; it does not book tickets or provide the full operational status feed.                                         |
| Interactive map                                       | [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/overview)   | Browser-side map rendering with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.                                                                      |
| Place search and details                              | [Google Places API](https://developers.google.com/maps/documentation/places/web-service/op-overview) | Server-side place grounding with `MAPS_API_KEY`; place photos through `/api/places/photo`, billed per image and live mode only.         |
| Routes and travel time                                | [Google Routes API](https://developers.google.com/maps/documentation/routes)                         | Route and distance checks for itinerary editing.                                                                                        |
| Time zones                                            | [Google Time Zone API](https://developers.google.com/maps/documentation/timezone/overview)           | Destination-local time calculations.                                                                                                    |
| Weather forecasts                                     | Google Weather API (days 0–10), Open-Meteo (days 11–14), climate fixture after day 14                | Implemented in the tool gateway with explicit forecast/climate provenance; generic SerpApi web results are not treated as weather data. |
| Flight delays, gates and operational status           | Aviationstack or another aviation-status provider                                                    | Optional future capability; not needed for hotel/flight price search.                                                                   |
| Chat, preferences, trip plans and SerpApi usage/cache | Upstash-compatible Redis REST store                                                                  | Configure `KV_REST_API_URL` + `KV_REST_API_TOKEN` in deployment; local/offline runs use an in-process fallback.                         |

Travelpayouts and Aviationstack are therefore not required for the current MVP. Add them only if the
product needs affiliate inventory/booking flows or operational flight-status data. SerpApi also does
not replace durable application storage.

The key must be set in the environment read by Next.js, normally `apps/web/.env.local` (or the
repository root `.env.local` when the workspace symlink is present). A key copied only into
`Downloads/dp.txt` is an inventory note and is not loaded by the application. For real provider
traffic, use:

```env
USE_MOCK_TOOLS=false
SERPAPI_KEY=your-serpapi-key
```

Keep real credentials out of Git and out of committed documentation.

For deployed durability, configure the Vercel project with `KV_REST_API_URL` and
`KV_REST_API_TOKEN` (the equivalent `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` names are also accepted). The shared Redis REST store backs chat turns,
preferences, generated trip plans, and SerpApi usage/cache state. Without those
variables, local tests and offline development use an in-process fallback and should not be treated
as a production deployment check.

## Mock server

`pnpm mock-server` starts an optional stub HTTP server on port 4000. The app never calls it: mock
tools run in process. It is kept for adapter
experiments and is started by Docker Compose.

## Docker

```bash
docker compose up
```

The compose file starts the web app on port 3000 (reading `.env.local`) and the stub mock server on
port 4000. Redis is optional and commented out.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

CI (`.github/workflows/ci.yml`) runs the same four commands on Node 22 for pull requests and pushes
to `main`.

Run focused packages with `pnpm --filter @trip/agents test`, `pnpm --filter @trip/orchestrator test`
or `pnpm --filter @trip/web test`. The web test script sets `NODE_OPTIONS` with POSIX shell syntax;
on Windows, run it from WSL or Git Bash.

If you run `pnpm build` while `pnpm dev` is running, start the dev server with
`NEXT_DIST_DIR=.next-dev` so the two do not share the `.next` output directory.
