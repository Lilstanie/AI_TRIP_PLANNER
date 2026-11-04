# Destination guide with OpenStreetMap unreachable: failure inventory

Written before the destination guide's and dining's place lookups were changed. The "before" run uses
`origin/main` source for `packages/agents/src/destination-guide/index.ts` and
`packages/agents/src/dining/index.ts`. The accommodation specialist is left out of the run
(`noAccommodation: true`), because with `MAPS_PROVIDER=osm` it fails earlier on
`Unsupported booking provider: osm`, a separate defect.

| Failure mode                                                                                 | Evidence the E2E or test must capture                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A rejected place lookup escapes the guide, so the workflow rethrows and the whole plan fails | Require the `/api/chat` stream to hold no `agent_failed` for `destination-guide` and to end in a `complete` frame.                                                            |
| The guide fills the gap with an attraction no provider returned                              | Require the guide section to hold no `attraction` item when every lookup failed.                                                                                              |
| The guide's source still claims mock, estimated or live place evidence                       | Require the guide source `kind` to be `unavailable` with a Maps label, and its assumptions to name the failed lookups instead of "Attractions come from provider candidates". |
| One failed category discards the places another category did return                          | Require a guide whose sight lookup fails and whose museum lookup succeeds to keep the museum attraction and report the sight lookup as unavailable.                           |
| The catch turns a cancelled request into a degraded proposal                                 | Require a lookup that rejects after the request was aborted to reject the guide with the abort, not return a proposal.                                                        |
| The guide claims weather for dates it could not check                                        | Require the weather tip to come from the unavailable-weather copy when no place gave coordinates.                                                                             |
| The other sections stop planning                                                             | Require the transport and itinerary sections in the completed plan, with the itinerary `unavailable` as it already is.                                                        |
| The check passes vacuously because the server used mock tools or never reached the stub      | Require the stub OpenStreetMap upstream to have received at least one place lookup (Nominatim `/search` or Overpass `/interpreter`).                                          |
| Dining awaits the same restaurant lookup without a catch, so it fails the plan the same way  | Require no `agent_failed` for `dining` and a completed plan whose dining section is `unavailable` with a Maps label.                                                          |
| Dining suggests a venue no provider returned                                                 | Require the dining section to hold no `meal` item, only the `meal-budget` envelope.                                                                                           |
| A later specialist reintroduces an uncaught `ctx.tools.maps.places` call                     | Require `pnpm --filter @trip/agents lint` to fail on a direct `maps.places` call outside `packages/agents/src/place-lookup.ts`.                                               |
| The evidence is not repeatable                                                               | Save the NDJSON stream, the stub request log and `summary.json` in `output/e2e/guide-places-unavailable/`.                                                                    |

The upstream is a stub started by the script that resets every connection, which is what a closed port
or unreachable OpenStreetMap host looks like to `fetch` (`TypeError: fetch failed`). The run shows how
the guide degrades, not how a real OpenStreetMap outage looks from a deployment's network.

Repeat with the server and the script sharing the stub's port (no `SERPAPI_KEY` or model keys needed):

```bash
USE_MOCK_TOOLS=false MAPS_PROVIDER=osm WEB_MAPS_PROVIDER=osm NOMINATIM_BASE_URL=http://127.0.0.1:4519 OVERPASS_BASE_URL=http://127.0.0.1:4519 OSRM_BASE_URL=http://127.0.0.1:4519 PHOTON_BASE_URL=http://127.0.0.1:4519 pnpm --filter @trip/web e2e guide-places-unavailable
```
