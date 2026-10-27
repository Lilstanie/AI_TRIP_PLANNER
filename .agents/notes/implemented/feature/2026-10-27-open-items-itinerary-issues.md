# Agent Note: Edit issues that name no stop stay visible as open items

Status: implemented
Owner: spec #730, review of #740

## Problem

The [open-items badge note](2026-10-27-open-items-badge.md) removed the Trip issues block and dropped
its free-text edit notices, on the reasoning that conflicts stay marked on the stop itself. That holds
for an edit issue whose `activityIds` match a stop. A route edit that cannot be verified can name no
stop (`activityIds` is empty), and `placeConflicts()` skips the legacy conflict sentence that repeats
an edit issue. Such an issue then appeared nowhere.

## Decision

- `unplacedIssues()` in `apps/web/lib/trip/conflicts.ts` returns the stored notices of every
  `plan.editIssues` entry other than `price_unverified` whose `activityIds` match no itinerary stop.
- `deriveOpenItems` adds one **Itinerary issue** open item for each, after the stop-based kinds. The
  badge counts it. The popover lists it as plain text, because there is no stop to select.
- Issues attached to a stop stay on that stop and add no row. `price_unverified` is not an open item.

This supersedes the "free-text edit notices are dropped" sentence of the badge note, in part: the rest
of that note stands.

## Alternatives considered

- Show the notices in the trip panel again: brings back the section the badge note removed.
- Attach them to the first stop of the day: invents a location the edit did not name.

## Consequences

- The badge count can include rows that do not open a stop.
- The Chinese heading is 行程问题; the notice text itself is shown as stored.

## Sources

- Review finding on PR #740; `trip-budget-issues` E2E and its failure inventory.
