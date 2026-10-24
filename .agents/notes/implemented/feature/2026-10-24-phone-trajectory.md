# Agent Note: the phone shows the trajectory ledger as a bottom tab

Status: implemented
Owner: spec #667, ticket #672

## Problem

The [Trajectory tab](2026-10-24-trajectory-tab.md) exists only in the desktop chat column, and the
[team panel](2026-10-24-team-panel-dsh-layout.md) left its phone sheet cards disabled because the phone had
nowhere to open the filtered trajectory.

## Decision

- **A fifth bottom tab.** `MobileView` gains `trajectory`, ordered between Trip and Mine and labelled
  Trajectory (轨迹). The saved layout accepts it; crossing to a wider layout turns it into the chat view, as
  Trip and Mine are mapped there. Panels stay mounted, so the tab's panel is always in the DOM and
  `PhoneTrajectory` renders the ledger only while the tab is selected.
- **Ledger only.** `TrajectoryView` takes `phone` and omits the timeline overview, which needs width the
  phone does not have. The ledger, toolbar search, hit stepping and the specialist filter bar are the same
  components as on desktop.
- **Inspector at full width.** At 520 px and below the record inspector covers the whole ledger panel and its
  resize handle is hidden; the close button returns to the ledger.
- **The sheet opens it.** `PhoneTeamButton` passes `onSelect`; a card press closes the sheet and files the
  same `trajectory-focus` request as on desktop. `PhoneTrajectory` owns the phone's filter, selects the tab
  and clears it with Show all records. `ChatPanel` still ignores the request on a phone.

## Alternatives considered

- **Reuse `ChatPanel`'s tabs on the phone.** The phone chat panel has the composer and disclaimer below the
  stream, so a ledger inside it would sit under the keyboard area; a tab of its own matches Trip and Mine.
- **Show the timeline above the ledger.** Lanes and labels do not fit 390 px without horizontal scroll.

## Consequences

- Five tabs at 390 px are about 75 px each, above the 44 px target; the label stays one word in both languages.
- E2E scripts that list the tab bar expect five tabs (`phone-shell`).
- The phone filter and the desktop filter are separate state, so resizing across 520 px clears the filter.
- Leaving the phone tab unmounts the ledger, as leaving the desktop tab does, so search text and folds reset on return; only the specialist filter survives. A turn jump therefore always meets a fresh ledger, and widening to desktop opens the conversation, never a replayed request.

## Sources

[2026-10-24 phone trajectory session log](../../../session-logs/2026-10-24-phone-trajectory.md)
