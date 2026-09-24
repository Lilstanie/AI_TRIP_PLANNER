# Agent Note: The workspace catalog is the only trip store

Status: implemented

## Problem

The workspace kept trips in two places. The catalog (`trip-workspace-catalog-v3`) autosaves every
chat and every planned trip, and lists them in the sidebar's Chats and Trips. A separate Save trip
button also wrote point-in-time snapshots to `trip-saved-v1`, shown only in a Saved trips dialog.
Once the sidebar's Saved trips entry was removed, that dialog could no longer be opened, so the
button wrote copies nobody could reach, and the two lists could disagree about what a "saved trip"
was.

## Decision

The catalog in `apps/web/lib/workspace/catalog.ts` is the only store for chats and trips, written
by the debounced autosave in `apps/web/components/workspace/useWorkspaceStorage.ts`. The active
trip's snapshot is still mirrored to `trip-workspace-v1` and read only as migration input when no
catalog exists yet. Snapshots carry `version` 3 and are schema-validated on load; corrupt data,
unknown versions and quota failures are reported and never overwritten automatically.

There is no Save trip button, Saved trips dialog, `save`, `loadSaved` or `restore`, and no
`SAVED_KEY` or `parseSaved`. The app neither reads nor deletes `trip-saved-v1`: data a browser
already holds there stays untouched, and nothing migrates it. Switching or starting a trip aborts
the in-flight request and drops its controller, so a late response cannot overwrite the trip now
open.

This supersedes [browser-local trip storage](../../archived/architecture/2026-09-16-browser-local-trip-storage.md);
its choice of browser-local storage over accounts still holds.

## Alternatives considered

**Keep reading `trip-saved-v1` to migrate old snapshots into a new catalog.** Declined: the
retired button's snapshots are copies of trips the catalog already holds under the same `tripId`,
and the migration only ever ran for a browser with no catalog at all. Reading it would keep a dead
key, its parser and an error message that pointed at a dialog that no longer exists.

**Delete `trip-saved-v1` on load.** Declined: the workspace never removes stored data on its own.

## Consequences

- One list of trips: the Trips list shows everything the workspace keeps.
- A point-in-time copy of a trip is no longer possible; the catalog holds each trip's latest state.
- Browsers that used the old button keep an unused `trip-saved-v1` entry until the user clears it.
- A schema change to persisted fields still needs a version bump and a decision on old snapshots;
  see [AUD base currency](2026-09-20-aud-base-currency.md).

## Sources

[2026-09-24 retire Save trip log](../../../session-logs/2026-09-24-retire-save-trip.md)
