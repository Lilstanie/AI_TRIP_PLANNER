# Agent Note: Deep provider selection behind ToolGateway

Status: implemented

## Problem

`createToolGateway()` presents one provider seam to the planning loop, but it returns the maps,
booking and weather module namespaces without selecting concrete adapters. Those modules read the
request data mode and environment again during each call, own different fallback rules, and remain
publicly importable. Deleting the factory moves an object literal and logging rather than
concentrating provider complexity, so the module is shallow and its "once per run" claim is not true.

## Decision

Keep the shared `ToolGateway`, `MapsPort`, `BookingPort` and `WeatherPort` interfaces unchanged.
`createToolGateway()` snapshots the request-scoped data mode and provider configuration once per
planning run, then composes three deep port modules. Each port module selects its concrete mock or
live adapters and owns any cross-adapter fallback; the top-level gateway only assembles them.
The package entry point exports the gateway and data-mode helpers, not raw maps, booking or weather
adapters. Internal adapter files remain available to package tests through internal paths. A runtime
and compile-time boundary test guards the public entry point.

The public factory remains `createToolGateway()` with no arguments. An internal factory accepts a
normalised runtime configuration plus injectable network and clock dependencies for gateway-level
tests. Missing credentials or unsupported capabilities continue to fail only when that capability
is called, so an unused flight provider cannot prevent a maps-only plan. Specialists may continue
reading the request data mode solely to describe source labels in this refactor; moving those labels
to result provenance requires a separate shared-contract decision and is not adapter selection.

This supersedes the earlier `mockEnabled()` requirement only inside gateway-owned deep ports: they
use the request-scoped `dataMode` already captured in the normalized runtime configuration.
Internal direct compatibility adapters continue to capture the same request scope through
`snapshotToolRuntime()`, but are not public package exports. Provider code does not read
`process.env.USE_MOCK_TOOLS` directly.

This is a behavior-preserving refactor. The current maps routing, hotel fallback, flight failure,
weather horizon, provenance and unavailable-data behavior are captured in the gateway matrix and
Planning-loop evidence. Truthful corrections to stale documentation accompany the refactor;
provider behavior redesign is separate work.

## Alternatives considered

**Keep selection inside every exported provider function.** Rejected because mode, configuration and
fallback knowledge remain spread across calls, and the gateway remains shallow.

**Put every provider implementation into one gateway module.** Rejected because maps, booking and
weather have different adapter sets and fallback rules; three deep port modules give those rules
locality while preserving one caller interface.

**Change the shared ports while restructuring.** Rejected because the current caller interface is
already small enough; changing it would mix a cross-package contract migration with an internal
ownership change.

**Redesign fallback and failure behavior in the same change.** Rejected because a changed Plan would
then be difficult to attribute to migration drift or to a deliberate policy change.

**Deliver the whole migration in one large change.** Rejected in favour of ordered tracer slices:
first the behavior matrix and gateway test seam, then runtime configuration and maps, booking,
weather, public-export cleanup, documentation, and final end-to-end evidence.

## Consequences

- One Planning Run holds one captured provider policy, and provider errors remain call-time errors.
- The public `ToolGateway` and shared ports stay unchanged; production package imports cannot reach
  raw adapters. A future adapter export fails the boundary test.
- Specialists still read request mode to label presentation-only fallback facts. Moving those labels
  into result provenance would require a separate shared-contract decision.
- Configuration changes during a run no longer switch its provider policy. This is intentional and
  protected by the provider matrix, which also records fallback and weather-horizon decisions in a
  repeatable artifact.

## Sources

- [Specification issue #126](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/126)
- [Provider behavior matrix issue #127](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/127)
- [Deep Maps provider selection issue #129](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/129)
- [Deep Booking provider selection issue #130](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/130)
- [Request-scoped data mode](../../implemented/feature/2026-09-21-request-scoped-data-mode.md)
- [SerpApi live prices and hotel fallback](../../implemented/feature/2026-09-20-serpapi-live-prices.md)
- [Weather forecast horizon](../../implemented/feature/2026-09-21-weather-forecast-horizon.md)
- [Inter-city rail fallback](../../implemented/feature/2026-09-26-intercity-rail-via-serpapi.md)
- [Deep Weather provider selection issue #128](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/128)
- [Final boundary issue #131](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/131)
- [Gateway matrix](../../../../packages/tools/tests/provider-matrix.e2e.test.ts)
- [Fixture Planning-loop and targeted-revision evidence](../../../../apps/web/tests/e2e/provider-boundary-planning.e2e.mjs)
- [Live Planning-loop isolation evidence](../../../../packages/orchestrator/tests/provider-boundary-live.e2e.test.ts)
- [Public-entry boundary check](../../../../packages/tools/tests/public-boundary.test.ts)
