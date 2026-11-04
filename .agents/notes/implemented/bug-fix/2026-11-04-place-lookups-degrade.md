# Agent Note: a failed place lookup degrades its section instead of failing the plan

Status: implemented
Owner: A (@Lilstanie)

## Problem

With OpenStreetMap unreachable in live mode, the destination guide awaited
`ctx.tools.maps.places` without a catch. The rejection (`TypeError: fetch failed` from
`packages/tools/src/overpass.ts`) escaped the specialist, `packages/orchestrator/src/planning/workflow.ts`
rethrew it, and the whole plan ended with "Unable to update this trip". Dining had the same uncaught
lookup. The itinerary already caught the same failure and returned an `unavailable` section, so one
provider outage broke the plan or not depending on which specialist hit it first.

## Decision

Specialists in `packages/agents` reach MapsPort place search only through `lookupPlaces` in
`packages/agents/src/place-lookup.ts`. A provider failure resolves to no places, is logged, and adds
a `Place provider unavailable for <category> in <city>` line to the proposal's assumptions. An aborted
request rethrows the signal's reason inside the catch, so cancellation never becomes a degraded
proposal. Each lookup degrades on its own, so a failed sight search keeps the museums another search
returned.

When any guide or dining lookup failed, the proposal source is `unavailable` with the label
`Maps provider`, ahead of the model-fallback and weather sources, because the missing place evidence is
what limits the section. The guide gives no attraction tip and dining no venue without a provider
candidate; the existing grounding checks still reject a model draft that names one. An ESLint
`no-restricted-syntax` rule in `eslint.config.mjs` fails on a direct `maps.places` call anywhere in
`packages/agents/src` other than `place-lookup.ts`.

## Alternatives considered

**Catch specialist failures in the workflow and drop the section.** Rejected: the workflow cannot tell
a provider outage from a defect, and the plan would lose the customs, safety, entry and weather tips
and the meal budget, which need no place data.

**Retry the OpenStreetMap request.** Rejected: an unreachable host stays unreachable within one plan,
and a retry hides the failure instead of reporting it.

## Consequences

- A guide or dining section planned during a place-provider outage shows `unavailable`, even when the
  model drafted the remaining tips.
- With `MAPS_PROVIDER=osm`, accommodation still fails earlier on `Unsupported booking provider: osm`
  (`packages/tools/src/booking-port.ts`); that is a separate defect, so the
  `guide-places-unavailable` E2E plans with `noAccommodation: true`.
- The E2E needs the server started with OpenStreetMap URLs that point at the stub's port; its header
  and `apps/web/tests/e2e/guide-places-unavailable.failures.md` list them.
