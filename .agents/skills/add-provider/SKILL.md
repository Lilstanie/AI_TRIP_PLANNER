---
name: add-provider
description: Add, replace or change an external data provider (maps, places, hotels, flights, weather, routes or any paid API reached through packages/tools) in AI_TRIP_PLANNER while keeping mock mode, typed failures, truthful provenance, AUD amounts and quota limits intact. Use when adding, replacing or changing a provider or its adapter.
---

# Add or change an external data provider

Providers reach agents only through the ports in `packages/shared/src/ports.ts` and the tool gateway
in `packages/tools/src/gateway.ts`. The gateway snapshots the data mode and provider configuration once
per planning run and composes one deep port module per capability (`maps-port.ts`, `booking-port.ts`,
`weather-port.ts`); each port picks its mock or live adapter and owns its fallback
([decision](../../notes/implemented/architecture/2026-10-03-deep-provider-selection.md)). Follow the path of the SerpApi and Google Places integrations;
their [notes](../../notes/implemented/feature/) record why each step exists. This is guidance, not a
script.

## 1. Verify the provider before coding

Read the provider's own documentation for request parameters and response fields. Error responses are
often undocumented: confirm their format with a request that costs nothing, such as an invalid key,
and never with a paid search.

## 2. Build the adapter in `packages/tools/src`

- Select the adapter in the capability's port module from the snapshotted `config.dataMode`, not by
  calling `mockEnabled()` or reading `process.env` inside the adapter. Mock fixtures return the same
  types as the live path, and tests and CI never need a key.
- Do not export the raw adapter from `packages/tools/src/index.ts`; the package exports the gateway and
  data-mode helpers only, and `tests/public-boundary.test.ts` fails otherwise. A missing key fails only
  when that capability is called, so an unused provider never blocks a plan.
- Raise a typed error with a `reason` (see `SerpApiError`) instead of a message callers must parse.
- Decide the fallback tier explicitly: a cheaper grounded source, a fixture, or a thrown error the
  agent turns into "unpriced" or "unavailable".
- Convert at the boundary: ratings to 0–10, prices to AUD whole-group totals, units the contracts
  expect. Leave unknown fields absent or conservative; never guess a value that looks real.
- Paid providers share a monthly quota and cache through `@trip/services`' durable store; without it
  the counter is in-process and resets on cold starts.

## 3. Report provenance

The agent that uses the data sets `source.kind` (`live`, `estimated`, `mock`, `fallback`,
`unavailable`) in the branch that ran, so the UI never overstates the data.

## 4. Contracts, configuration and docs

- New fields on shared types are optional and additive where possible; a `packages/shared` change
  needs an Agent Note in the same PR.
- Add each variable name to `.env.example` with a comment; never a value.
- Update the provider table in [development.md](../../../docs/development.md).

## 5. Verification

Prefer an E2E check that exercises the user-visible provider path and leaves a repeatable artifact.
Stub the provider so the run needs no credentials and spends no quota. If adapter behavior must be
tested in isolation, first enumerate every way it could fail before writing implementation code, then
derive focused checks for request parameters, success mapping, conversions, typed errors and fallback
tiers. Add the new provider's live, degraded and unavailable rows to the gateway matrix in
`tests/provider-matrix.e2e.test.ts`. Never add unit tests after implementation code. Then follow
[pre-push-checks](../pre-push-checks/SKILL.md) and, for visible results,
[ui-verification](../ui-verification/SKILL.md) in both data modes.
