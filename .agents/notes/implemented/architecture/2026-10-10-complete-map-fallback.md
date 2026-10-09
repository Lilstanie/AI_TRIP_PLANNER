# Agent Note: Complete free map fallback and keep saved coordinates across providers

Status: implemented

## Problem

The provider seam existed, but free search, cards, maps and transit were missing. Google IDs cannot
be looked up by OSM. A saved Google stop therefore lost its location during an outage, and separate
browser tabs could overwrite each other's edits despite their local revision checks.

## Decision

Complete the existing web provider with Photon/Nominatim search and details, optional licensed
Commons photos, OSRM walking/driving, Transitous public transport and offline time zones. The browser
tries Google then MapLibre/OpenFreeMap, or selects OSM directly. Place IDs stay provider-scoped;
no Google ID is queried against OSM. Optional `ProposalItem.savedPlace` stores only name, address
and coordinates when a place is saved, and Undo restores it. Older plans remain valid. Without
saved coordinates, an unavailable Google place remains unavailable rather than being guessed.

Nominatim uses one process-wide one-second queue and ten-minute successful-answer caches. Transitous
uses its v6 plan schema and accepts a duration only with a transit leg. Provider failures never
supply a guessed transit duration. Mock providers and MapLibre's empty style need no paid services.

Same-browser tabs acquire one Web Lock per trip before background checks or edits. Successful applies
publish a plan fingerprint before releasing the lock; stale tabs cannot edit or autosave over it.
Cancelled results publish nothing. This is browser-local protection, not server-authoritative or
cross-device concurrency control; clients without Web Locks retain a best-effort fingerprint check.

This partly supersedes [the provider seam](2026-10-09-web-map-provider-fallback.md): the free methods
are now implemented and the shared activity contract gains `savedPlace`.
It resolves [the leg failure discrepancy](../feature/2026-10-08-leg-travel-times.md): retain the
existing behavior, keeping a non-move edit with its keyed route notice while refusing blocked moves
and blocked scheduling. This preserves user-entered times without inventing a failed route.

## Alternatives considered

- Query OSM using Google IDs: IDs are unrelated and a guessed match could move a saved stop.
- Persist photos and full provider payloads: unnecessary for outage recovery and conflicts with
  Google's photo-name lifetime. Only the minimum display and routing snapshot is stored.
- Describe `baseVersion` as a server revision: the endpoint validates the supplied plan only; there
  is no server-owned plan revision against which to compare it.

## Consequences

Mixed trips remain displayable and routable when their saved coordinates exist. Photos and ratings
remain provider-specific; OSM has no invented ratings. Public providers have no SLA. Nominatim's
process queue is insufficient across multiple instances; self-host or coordinate globally at scale.
Live service coverage and availability differ from deterministic fixture evidence. Physical-device
checks (#173 and #182) remain separate from browser viewport checks.

## Sources

- Issues #270–#277 and PR #278.
- [Provider policies](../../../../docs/architecture.md#free-services-limits-and-terms).
- [Transitous API](https://transitous.org/api/) and [Photon](https://github.com/komoot/photon).
