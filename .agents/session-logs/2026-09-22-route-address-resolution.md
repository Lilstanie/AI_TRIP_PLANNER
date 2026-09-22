---
date: 2026-09-22
author: Claude Opus 5 (with A / @Lilstanie)
branch: fix/route-address-resolution
pr: none
area: packages/shared, packages/tools, packages/agents
contract-impact: packages/shared
---

# Route lookups now say which place they mean, not just its name

## What changed

- `packages/shared/src/ports.ts`: new exported `GeoPoint`; `RouteQuery` gains optional
  `fromLocation` / `toLocation`; `Place.location` reuses `GeoPoint` (same shape).
- `packages/tools/src/maps.ts`: `waypoint()` sends `location.latLng` when coordinates are usable and
  `{ address }` otherwise, in both `route()` and `routeOptions()`; `googleOriginTimeZone` became
  `originTimeZone(q, …)` and skips the Places search when the origin is already resolved; the OSM
  path skips Nominatim the same way; `geocode()` now returns a `GeoPoint` (its `label` was unused).
- `packages/agents/src/itinerary/index.ts`: `placeCoordinates()` maps a candidate's name to its
  position, keyed as `validateDraft` normalises names; `travelConflicts` builds one `RouteQuery` and
  uses it for both `route` and `routeOptions` instead of two hand-built copies.
- Tests: 6 in `packages/tools/tests/maps.test.ts`, 2 in `packages/agents/tests/itinerary/index.test.ts`.

## Why

[Agent Note](../notes/implemented/architecture/2026-09-22-route-query-coordinates.md). Short version:
the Places search already returned exact coordinates, the planner threw them away, and the provider
was asked to re-guess them from a name that is not unique. When it guessed a namesake elsewhere, the
itinerary reported "no route returned" as a geography conflict about the traveller's trip.

## Validation

`pnpm typecheck` clean. `pnpm test` 564/564 across 6 packages. `pnpm lint`, `pnpm build`,
`pnpm verify:docs`, `pnpm verify:protected` clean. Not yet exercised against the live Google key.

CI caught two typed-spy errors the first time: `pnpm typecheck` had been run before the new tests
were added, and `vitest run` does not typecheck. Tests are typechecked (DEC-003), so typecheck has
to come after the last test edit, not before it.

## Notes for the next person

- Inter-city hops (`packages/agents/src/transport`) still send bare city names; there is no `Place`
  behind them to resolve. Less ambiguous, but not zero — "Newcastle" and "Perth" exist twice.
- This removes one cause of the spurious geography conflict, not the conflict path itself. If a
  provider gap still surfaces as a conflict after this, the fix is to stop calling it one.
- Next in the agreed order: unpriced legs stop raising conflicts, then intra-city hops move into the
  Getting around section.
