# Agent Note: Saved trips live in browser storage

Status: implemented
Owner: E (@WhW0591)

## Problem

Travellers need to save a trip, restore it after a refresh, and keep unfinished form and chat
input. The product is single-user and has no accounts.

## Decision

Trips are saved in the browser's `localStorage` under `trip-workspace-v1` (current workspace)
and `trip-saved-v1` (saved trips), defined in `apps/web/lib/workspace/workspace.ts`. Snapshots
carry a `version` (currently 3) and are schema-validated on load; corrupted data, unknown versions
and quota failures are reported to the user instead of crashing. Restoring aborts any in-flight
request so a late response cannot overwrite the restored state.

## Alternatives considered

**Server-side persistence with accounts.** Deferred, not rejected: the user explicitly chose
browser-local saving for this phase, and durable storage is next on the
[roadmap](../../../../docs/roadmap.md).

## Consequences

- Saved trips are limited to one browser on one device.
- A schema change to persisted fields needs a version bump and a decision on old snapshots; see
  [AUD base currency](2026-09-20-aud-base-currency.md).

## Sources

[2026-09-16 UI P2 log](../../../session-logs/2026-09-16-ui-p2.md)
