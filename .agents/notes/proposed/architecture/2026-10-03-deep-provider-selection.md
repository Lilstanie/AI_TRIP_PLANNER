# Agent Note: Deep provider selection behind ToolGateway

Status: proposed

## Problem

`createToolGateway()` presents one provider seam to the planning loop, but it returns the maps,
booking and weather module namespaces without selecting concrete adapters. Those modules read the
request data mode and environment again during each call, own different fallback rules, and remain
publicly importable. Deleting the factory moves an object literal and logging rather than
concentrating provider complexity, so the module is shallow and its "once per run" claim is not true.

## Proposal

Keep the shared `ToolGateway`, `MapsPort`, `BookingPort` and `WeatherPort` interfaces unchanged.
`createToolGateway()` snapshots the request-scoped data mode and provider configuration once per
planning run, then composes three deep port modules. Each port module selects its concrete mock or
live adapters and owns any cross-adapter fallback; the top-level gateway knows only how to assemble
them. Raw maps, booking and weather adapters stop being public package exports, while their
implementations remain available to tests through internal paths.

The public factory remains `createToolGateway()` with no arguments. An internal factory accepts a
normalised runtime configuration plus injectable network and clock dependencies for gateway-level
tests. Missing credentials or unsupported capabilities continue to fail only when that capability
is called, so an unused flight provider cannot prevent a maps-only plan. Specialists may continue
reading the request data mode solely to describe source labels in this refactor; moving those labels
to result provenance requires a separate shared-contract decision and is not adapter selection.

This supersedes the earlier `mockEnabled()` requirement only inside gateway-owned deep ports: they
use the request-scoped `dataMode` already captured in the normalized runtime configuration.
Temporary direct compatibility adapters continue to capture the same request scope through
`snapshotToolRuntime()` until issue #131 removes those public bypasses. Provider code still never
reads `process.env.USE_MOCK_TOOLS` directly.

This is a behavior-preserving refactor. The current maps routing, hotel fallback, flight failure,
weather horizon, provenance and unavailable-data behavior are captured before implementation and
remain unchanged. Truthful corrections to stale documentation and selection logging accompany the
refactor, but provider behavior redesign is separate work.

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

## Acceptance criteria

- One gateway creation snapshots one request data mode and one provider configuration.
- Maps, booking and weather each expose the existing shared port interface through a deep module.
- Cross-adapter fallback is private to the port that owns it.
- Production code cannot bypass `ToolGateway` through the `@trip/tools` package entry point.
- The public gateway factory stays zero-argument; only an internal factory exposes runtime and test
  dependencies.
- Missing or unsupported capabilities retain their current call-time failure behavior rather than
  making gateway creation fail.
- Specialist data-mode reads remain limited to presentation and do not select provider adapters.
- A gateway-level matrix proves mock isolation, live selection, current fallback and failure paths,
  weather horizons and concurrent request-mode isolation before the implementation changes.
- Existing planning end-to-end checks leave repeatable artifacts and show no change to Plan,
  Conflict or provenance behavior.
- Provider selection logs and versioned documentation describe the behavior the code actually runs.

## Risks

- Snapshotting configuration exposes any code that relied on mutating environment variables during
  one planning run; that behavior is not intended, but the matrix must make the change explicit.
- Moving fallback code can accidentally change which errors propagate or which provenance is shown.
- Removing raw exports can break an overlooked internal caller, so the export cleanup follows a
  full repository reference check.
- Keeping Specialist data-mode reads means provenance knowledge is not yet fully local to the
  gateway; removing that exception may require a later shared-contract change.
- Existing weather documentation describes a seasonal fixture while the implementation uses an
  Open-Meteo archive; correcting that record must not silently change the runtime again.

## Sources

- [Specification issue #126](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/126)
- [Provider behavior matrix issue #127](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/127)
- [Deep Maps provider selection issue #129](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/129)
- [Deep Booking provider selection issue #130](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/130)
- [Request-scoped data mode](../../implemented/feature/2026-09-21-request-scoped-data-mode.md)
- [SerpApi live prices and hotel fallback](../../implemented/feature/2026-09-20-serpapi-live-prices.md)
- [Weather forecast horizon](../../implemented/feature/2026-09-21-weather-forecast-horizon.md)
- [Inter-city rail fallback](../../implemented/feature/2026-09-26-intercity-rail-via-serpapi.md)
