---
date: 2026-10-09
author: Claude Code (Opus 5.5)
branch: feature/map-provider-seam
pr: none
area: apps/web, docs
contract-impact: api
---

# Web map calls go through a Google-first provider with an OSM fallback seam (#271)

## What changed

- `apps/web/lib/map-provider/`: `MapProvider` interface (`types.ts`), Google provider (`google.ts`),
  OSM placeholder that reports itself unavailable (`osm.ts`), fallback with failure classification
  and cool-down (`fallback.ts`), selection by `WEB_MAPS_PROVIDER` and the `MOCK_GOOGLE_MAPS` switch
  (`index.ts`), provider-scoped ids (`ids.ts`).
- `lib/integrations/google.ts`: `GoogleRequestError` carries Google's reason; Time Zone denials and
  quota statuses become typed errors with the same notice; routes split into throwing
  `requestGoogleRoute*` cores and the unchanged never-throwing wrappers.
- Places search, details, photo and route-from-location routes and `LIVE_EDIT_DEPS` (`googleRoute`
  renamed `route`) ask the provider; responses add `source` (photo: `X-Map-Provider` header).
- Agent Note `implemented/architecture/2026-10-09-web-map-provider-fallback.md`; docs
  `architecture.md` (web map providers, free services' limits and terms) and `development.md` env
  rows, with zh pairs; `.env.example` (approved by Joey on 2026-10-09).

## Why

See the Agent Note. With OSM not implemented, the fallback rethrows Google's own failure, so notices
and statuses are unchanged; route tests reset the shared provider because the cool-down is process
state.

## Validation

- `pnpm --filter @trip/web test`: 604 passed (exit 0); typecheck and lint exit 0.
- `pnpm verify:docs` exit 0; `check-pairs.mjs` 24 pairs, exit 0.
- `DATA_MODE=mock pnpm --filter @trip/web e2e auto-save-places timeline leg-mode-choice
  drawer-walkthrough check-entry-point`: exit 0. A first run failed two timeline checks and one zh
  drawer-walkthrough check; both scripts passed on rerun here and on the unchanged base commit
  (concurrent E2E load).
- Free services' terms read from the operators' pages on 2026-10-09 (Photon from its README).

## Notes for the next person

- `SIMULATED_EDIT_DEPS` still never calls a provider; the OSM fixture provider (#272/#273) should
  back it and honour `MOCK_GOOGLE_MAPS=unavailable`.
- Browser places fetches send no `x-trip-data-mode`; the server default decides their data mode.
- `route()` accepts `hints` coordinates for OSM routes between Google ids; no caller passes them yet.
