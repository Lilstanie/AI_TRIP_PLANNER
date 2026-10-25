# Agent Note: phone navigation follows the planning journey

Status: implemented
Owner: spec #715 and tickets #716–#719

## Problem

The phone gives Trajectory the same navigation prominence as conversation, map exploration and
Plan editing. Mine combines saved Trips, chats and settings without a clear primary collection.
The traveller requested a substantial phone workspace redesign centred on planning before departure.

## Decision

The traveller accepted these choices during the [design interview](../../../../docs/design/mobile-workspace-redesign.md):

- Use Chat, Map, Trip and Mine as primary phone views; continue hiding Trip before a Plan exists.
- Open Trajectory from the team entry as a full-screen view, preserving ledger search, filters,
  inspection and return to the originating view.
- Keep Map and Trip as separate full-screen views with shared selected day and Stop context.
- Make saved Trips primary in Mine, recent chats secondary, and group account/settings behind one entry.

This decision partly supersedes the entry placement and primary-view list in the
[phone Trajectory decision](../../implemented/feature/2026-10-24-phone-trajectory.md).
Its full-panel ledger and specialist-focus behaviour still apply. The
[phone shell](../../implemented/feature/2026-10-05-phone-shell.md) and
[record card](../../implemented/feature/2026-10-24-phone-trajectory-cards.md) decisions continue to guide
state retention, keyboard behaviour and readable controls. The implementation keeps the team entry
in the existing layout surface and shows the Trajectory ledger in a native modal dialog.

## Alternatives considered

- Keep the five existing tabs: preserves direct Trajectory access, but the traveller chose to give
  the planning journey priority and access Trajectory through the team entry instead.
- Compress Map and Trip into one split view: reduces primary views, but loses the full-screen space
  retained by the accepted design and repeats the phone shell's rejected half-height map trade-off.

## Consequences

Without a Plan, Chat, Map and Mine are reachable; with a Plan, Trip joins them without forcing a
tab switch. The team entry opens a full-screen Trajectory with its filters, search and inspector,
and closing returns to the originating view. Saved Trips, recent chats, search, creation actions,
data mode, account and settings remain reachable in Mine. Phone state survives tab switches and
relevant width changes, while desktop and tablet navigation stays unchanged.

Trajectory takes an extra entry step, so the team affordance must remain discoverable and usable.
Shared day and Stop selection must drop removed Stops and empty days rather than retain stale
context. Editing has a separate discard decision and survives view switches. Saved Trips open Trip
and recent chats open Chat, with each Trip restoring its own valid day and Stop context.

Repeatable browser evidence covers the accepted design scenarios. Browser viewport simulation does
not prove physical keyboards, installed-app safe areas or live provider behaviour.

## Sources

[phone navigation session log](../../../session-logs/2026-10-26-phone-workspace-navigation.md)
