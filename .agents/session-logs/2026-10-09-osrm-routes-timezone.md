---
date: 2026-10-09
author: Claude Code (Haiku 5.5)
branch: feature/osm-routes-timezone
pr: none
area: apps/web, docs
contract-impact: none
---

# Walking and driving times from OSRM, offline time zones, and the map-fallback E2E (#273)

## What changed

- `apps/web/lib/map-provider/osm.ts`: the OSM provider now answers `route`, `routeFromLocation` and `timeZone`
  (placeDetails in mock mode only). `osrm.ts` is the OSRM client (per-profile base URLs, 10-minute cache).
  `time-zone.ts` is the offline zone from `@photostructure/tz-lookup`. `mock-osm.ts` holds the mock fixtures.
- `apps/web/lib/trip/trip-edit.ts`, `app/api/trip/preview-edit/route.ts`: legs get coordinate hints, place
  details are asked once per edit, and mock edits use the provider only when `mockUsesProvider()` says Google
  is simulated down.
- `apps/web/lib/trip/timeline.ts`, `TimelineParts.tsx`, `components/map/TripMap.tsx`: each verified time is
  labelled with its service (`Google` / `OSRM`); the route-from-location label is no longer hard-coded Google.
- `apps/web/tests/e2e/map-fallback.e2e.mjs`: new scenario, run with `MOCK_GOOGLE_MAPS=unavailable`.
- Docs: `architecture.md`, `workspace-ui.md`, `development.md` and Chinese pairs; Agent Note
  `implemented/architecture/2026-10-09-osrm-routes-offline-time-zone.md`.

## Why

- The public OSRM demo server routes cars only, so walking uses its own FOSSGIS foot instance.
- Cycling is not added: a cycling leg mode is a shared contract change.

## Validation

- `pnpm --filter @trip/web test`: 52 files, 620 tests, exit 0.
- `pnpm exec tsc --noEmit`: exit 0. `pnpm --filter @trip/web lint`: exit 0. `pnpm verify:docs`: exit 0.
- `check-pairs.mjs check`: 24 pairs, exit 0. Prettier `--check` on changed files: pass.
- `DATA_MODE=mock MOCK_GOOGLE_MAPS=unavailable pnpm --filter @trip/web e2e map-fallback`: exit 0,
  artifact `output/playwright/map-fallback/after/summary.json`.
- `DATA_MODE=mock pnpm --filter @trip/web e2e drawer-walkthrough`: exit 0 when run alone. Two runs
  started side by side with another agent's run failed with "browser has been closed" on both branches,
  so the failure is load, not this change. Not re-run for timeline, leg-mode-choice or check-entry-point
  after the final edits; the earlier batch run passed those three.

## Notes for the next person

- Search (#272) and photos (#275) are not in this branch. The map-fallback scenario stubs the browser's place
  search with OSM fixture places; remove the stub once #272 lands.
- OSM `placeDetails` mock fixtures live in `osm.ts` and `mock-osm.ts`; #272 owns the live path and may conflict.
- `MapProviderUnavailableError` moved to `errors.ts`; #272's branch also defines it in `osm.ts`.
- Persisted legs keep no service label (`arriveBy` has no provider field).
- OSRM calls are cached but not throttled to one a second.
- Run E2E scripts one at a time: parallel runs make drawer-walkthrough close its browser mid-walk.
- `.env.example` is protected and not changed; `OSRM_BASE_URL` and `OSRM_FOOT_BASE_URL` are documented in
  `docs/development.md`.
