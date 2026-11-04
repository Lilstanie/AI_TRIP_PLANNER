# Agent Note: An unsearchable stay is unpriced, not a failed plan

Status: implemented

## Problem

With `USE_MOCK_TOOLS=false`, `MAPS_PROVIDER=osm` and no `SERPAPI_KEY`, every Live data plan failed with
"Unable to update this trip": the Booking port rejects the stay search with `Unsupported booking
provider: osm`, the accommodation specialist awaited it without a catch, and the planning workflow
rethrows a specialist failure. The same happened in production whenever SerpApi hotels failed and Google
was not configured, and when no candidate met the confirmed accommodation preferences ("No valid
stays"). One missing price took the whole plan down, although the roadmap asks provider failures to
degrade visibly and safely, and transport already degrades a failed flight search to an unpriced,
`unavailable` section.

## Decision

This supersedes [Preserve hotel-search failure without Google capability](../../archived/bug-fix/2026-10-14-serpapi-osm-stay-failure.md)
for the planner outcome; the Booking port still rethrows the typed error and never invents a fallback
estimate.

The accommodation specialist catches a failed stay search per city (after honouring cancellation) and
treats an empty eligible list the same way. Priced cities keep their stays. Each unpriced city becomes
one `hotel` item with its day, check-in and check-out dates and night count, and no `estCost` or
`selectionId`; `floorCost` and the section total count only priced stays. When any city is unpriced the
section source is `unavailable` ("Stay provider"), and a `stayUnavailable` or `stayNoMatch` plan issue in
`packages/shared/src/plan-issues.ts` is added to `conflictsWith`. The model path lists those cities under
`unpricedStays` and is told not to choose for them.

The web shows the unpriced stay in the budget card (counted as unpriced, Accommodation "Not costed", the
conflict as a localized notice), in the Stays row ("Price unknown"), as a calendar stay bar over every
night, and in "To check" as an "Unpriced stay" that selects its day. Agent Lab's `provider-empty-result`
fault is therefore `degraded`, not terminal.

## Alternatives considered

- Keep failing the plan (the superseded decision): the traveller loses transport, the day plan, meals and
  the guide because one price is missing.
- Catch specialist failures in the workflow: every specialist would then need a generic empty section,
  which hides which nights are missing and why.
- Price the nights from a fixture or a typical rate: a fictional price presented as an estimate, which
  the roadmap forbids.

## Consequences

- An OSM deployment without SerpApi plans in Live data, with accommodation visibly unpriced.
- The open conflict sends accommodation into a revision round, which searches again and is bounded by the
  round limit, the same as an unavailable flight.
- The chat route no longer special-cases "No valid stays"; that message key is removed.
- `apps/web/tests/e2e/stay-unavailable.e2e.mjs` reproduces the report against a stubbed OSM upstream and
  keeps its evidence in `output/playwright/stay-unavailable/`; its failure inventory sits beside it.
- contract-impact: packages/shared (two new plan issue kinds).

## Sources

- [Architecture: transport and accommodation](../../../../docs/architecture.md)
- [Roadmap](../../../../docs/roadmap.md)
