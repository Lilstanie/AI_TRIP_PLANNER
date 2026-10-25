# Agent Note: a reply's summary line opens its turn in the trajectory

Status: implemented
Owner: spec #667, ticket #673

## Problem

A finished reply's Think row says what the team did ("5 subagents"), but the [Trajectory tab](2026-10-24-trajectory-tab.md) was reachable only through the tab or a team card, with no way to land on the turn that reply belongs to.

## Decision

- **The summary is the control.** In a finished reply the summary text of the Think row is a button. Pressing it files a `trajectory-focus` request carrying the reply's turn and no assistant, so the existing consumers (`ChatPanel` on desktop, `PhoneTrajectory` on a phone) clear the specialist filter and show the trajectory.
- **Turn numbers come from one place.** `messageTurns` in `lib/trajectory/adapter.ts` numbers messages by the same rule `buildTrajectory` uses for its turns, so the chat and the ledger agree.
- **The view scrolls through the ledger's own focus.** `TrajectoryView` unfolds the turn and sets the record focus on its first record, which the table already scrolls to and centres. The consumer clears its jump once applied, so reopening the tab later does not scroll again.
- **The row still toggles.** The summary stops click and key events; the label, chevron and the rest of the line keep toggling the Think row.

## Alternatives considered

- **A separate "Open in trajectory" link beside the summary.** It repeats what the summary already says; the spec asks the summary itself to open the tab.
- **Scrolling by DOM query in the chat.** The ledger is virtualised, so only its own focus mechanism can reach a row that is not rendered.

## Consequences

- The Think row's toggle is a native button holding the icon and title; the summary button is its sibling inside the line, so no button nests in another. Clicking the rest of the line still toggles the row.
- Subagent rows and the live row keep plain summaries.

## Sources

[2026-10-24 summary jump session log](../../../session-logs/2026-10-24-summary-jump.md)
