# Agent Note: Preserve hotel-search failure without Google capability

Status: implemented

## Problem

When SerpApi hotel search fails in an OSM deployment, no configured provider can supply a grounded stay estimate. A provider-level error must not turn into a misleading booking-provider error, a fabricated stay or a successful accommodation section.

## Decision

The Booking port uses Google Places estimates after a SerpApi hotel failure only when Google Maps is selected and `MAPS_API_KEY` is configured. Otherwise it rethrows the original typed `SerpApiError`. The accommodation specialist failure propagates through the existing stay-search and specialist failure events; the planner does not return a successful or partial plan. When Google Places is configured, its grounded property data and estimated price remain identified in the accommodation proposal's source and freshness fields.

This extends the provider-selection boundary recorded in [SerpApi live prices](../feature/2026-09-20-serpapi-live-prices.md): that note describes the gateway behavior; this one records the corresponding planner outcome and repeatable evidence.

## Alternatives considered

- Use Google Places regardless of selected maps provider: rejected because the deployment has not configured that capability.
- Return a successful stay section with a fabricated estimate: rejected because it would present unsupported accommodation as available.

## Consequences

- OSM deployments retain the typed SerpApi failure and report the stay search failure through existing accommodation progress handling.
- Google Places remains a useful estimate fallback when its capability is configured, with provenance visible in the plan.
- Gateway and planner E2E tests preserve both configuration outcomes as repeatable evidence.

## Sources

- [Issue #323](https://github.com/Lilstanie/AI_TRIP_PLANNER/issues/323)
- [Architecture: provider boundary](../../../../docs/architecture.md)
