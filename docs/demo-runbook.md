# Demo runbook

English | [中文](demo-runbook.zh.md)

How to build and run the app on a laptop that has nothing prepared, and what to do when the network
or a provider fails during the Week 13 demonstration. Full environment-variable descriptions live in
[Development](development.md); this page lists only what a demo needs.

## Toolchain

| Tool | Version                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| Node | 24.14.1 (`package.json` requires `>=22`)                                                  |
| pnpm | 9.15.0 (pinned by `packageManager`; a newer pnpm prints an update notice and still works) |
| Git  | 2.39.5                                                                                    |

## Build from a clean copy

```bash
pnpm install
pnpm build
pnpm --filter @trip/web start -p 3000
```

The build needs **no environment variables at all** and prints no warnings. Expect roughly 30 seconds
for the build and under a second to start, after the install.

`pnpm install` finishes in seconds only when the pnpm store already holds the packages. On a laptop
that has never built this project the same step downloads about 830 MB, and the finished tree is
about 1.3 GB with `.next`. **Install before the venue, not at it.**

## Environment variables

Names only. Never paste a key into this page, a commit, a fixture or a chat message.

| Variable                                                | Without it                                                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEEPSEEK_API_KEY`                                      | Itinerary, dining and destination guide fall back to deterministic local plans and show the `fallback` provenance badge. The plan still completes. |
| `SERPAPI_KEY`                                           | No live flight or hotel prices; `hotelsAndFlights` reports false.                                                                                  |
| `MAPS_API_KEY`                                          | Places, Routes and Time Zone fall back to the free OpenStreetMap services.                                                                         |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`                       | The workspace map falls back to OpenStreetMap tiles. Restricted to the demo origins.                                                               |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | No sign-in. A deployment without them serves mock data only, so no provider quota is spent.                                                        |
| `DATABASE_URL`                                          | The account routes answer 503. Signing in works; nothing is stored.                                                                                |
| `USE_MOCK_TOOLS`                                        | Defaults to mock. Set it to exactly `false` for live providers.                                                                                    |

For the demonstration the one key that changes what the audience sees is `DEEPSEEK_API_KEY`. Mock
data replaces the providers; it does not replace the model.

## Falling back to mock data

Mock mode is self-contained: no network, no keys, no accounts.

- **Whole deployment:** leave `USE_MOCK_TOOLS` unset, or set it to anything other than `false`.
- **One run:** the top-bar data-mode toggle sends `x-trip-data-mode: mock` for that request. The
  toggle is disabled, and live is refused, for a visitor who may not spend the allowance.
- **Check what the server will actually do:** `curl http://localhost:3000/api/data-mode` reports
  `configured`, `liveAvailable` and which providers are configured.

A full five-agent plan completes in mock mode with no keys configured. Three sections carry the
`fallback` badge when no model key is present, as the table above describes.

`maps: true` in that response means a map provider is reachable, which includes the free
OpenStreetMap fallback. It does not mean `MAPS_API_KEY` is set.

## If something fails on the day

| Symptom                            | Action                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| No network at the venue            | Nothing to do: mock mode is the default and needs none.                             |
| A provider errors or is over quota | The section degrades and says so in its provenance badge; carry on.                 |
| `REQUEST_DENIED` from Google       | The key is wrong, deleted, or its APIs are not enabled. Switch that laptop to mock. |
| Port 3000 is taken                 | `pnpm --filter @trip/web start -p 3100`.                                            |
| The build was never run here       | Stop. Installing at the venue takes minutes, not seconds.                           |
