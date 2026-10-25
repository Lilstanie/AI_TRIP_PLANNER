# Agent Note: phone navigation follows the planning journey

Status: proposed

## Problem

The phone gives Trajectory the same navigation prominence as conversation, map exploration and
Plan editing. Mine combines saved Trips, chats and settings without a clear primary collection.
The traveller requested a substantial phone workspace redesign centred on planning before departure.

## Proposal

The traveller accepted these choices during the [design interview](../../../../docs/design/mobile-workspace-redesign.md):

- Use Chat, Map, Trip and Mine as primary phone views; continue hiding Trip before a Plan exists.
- Open Trajectory from the team entry as a full-screen view, preserving ledger search, filters,
  inspection and return to the originating view.
- Keep Map and Trip as separate full-screen views with shared selected day and Stop context.
- Make saved Trips primary in Mine, recent chats secondary, and group account/settings behind one entry.

This partly supersedes the entry placement in the
[phone Trajectory decision](../../implemented/feature/2026-10-24-phone-trajectory.md).
Its full-panel ledger and specialist-focus behaviour still apply. The
[phone shell](../../implemented/feature/2026-10-05-phone-shell.md) and
[record card](../../implemented/feature/2026-10-24-phone-trajectory-cards.md) decisions continue to guide
state retention, keyboard behaviour and readable controls. This proposed note changes no runtime
behaviour; cross-link and correct affected implemented notes when shipping the change.

## Alternatives considered

- Keep the five existing tabs: preserves direct Trajectory access, but the traveller chose to give
  the planning journey priority and access Trajectory through the team entry instead.
- Compress Map and Trip into one split view: reduces primary views, but loses the full-screen space
  retained by the accepted design and repeats the phone shell's rejected half-height map trade-off.

## Acceptance criteria

- Without a Plan, Chat, Map and Mine are reachable. With a Plan, Trip joins them without forcing a tab switch.
- The team entry opens a full-screen Trajectory, with usable filters, search and inspector. Closing
  returns to the view that opened it.
- Selecting a later-day Stop carries its day and selection between Map and Trip, including repeated places.
- Saved Trips, recent chats, search, creation actions, data mode, account and settings remain reachable in Mine.
- Phone state survives tab switches and relevant width changes. Existing desktop/tablet navigation is preserved.
- Repeatable browser evidence covers the scenarios in the design draft; unverified real-device
  behaviour is reported explicitly.

## Risks

- Trajectory takes an extra entry step; the team affordance must remain discoverable and usable.
- Sharing day/Stop selection requires handling removed Stops and days without selecting stale data.
- Closing changed fields requires an explicit discard choice; switching views preserves editing.
- Saved Trips open Trip, recent chats open Chat; each Trip restores its own valid day/Stop context.
