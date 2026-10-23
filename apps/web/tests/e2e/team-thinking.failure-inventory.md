# Team panel opens thinking rows failure inventory

Written before the code (#634). Each line is a way the press could fail; the browser journey must distinguish them.

- A row for an involved specialist has no button, or its button has no accessible name.
- A "not involved" or "idle" row exposes a button or any other action.
- Pressing a specialist leaves the panel or the phone sheet open.
- Pressing a specialist from a reply's panel opens the latest run's thinking process instead of that reply's.
- Pressing a specialist from the latest-run panel opens a different reply's thinking process.
- The thinking process opens but the specialist's `Subagent` row stays collapsed, or another specialist's row also expands.
- The row that expands is the first round's although the specialist worked again in a later round.
- The chat does not scroll to the row when it is above the visible area, or the row ends up under the composer or top bar.
- Focus stays on the panel button, on the page body, or on the wrong row.
- Pressing the Coordinator expands a specialist row, or leaves the thinking process closed.
- The press works at 1440 but not at 800 or 390 (the sheet's focus trap or leaving animation swallows the focus).
- Pressing while a turn is running targets a settled reply instead of the live thinking process.
- Pressing a specialist while the Map is showing (phone Map tab, narrow desktop Map view) leaves the chat hidden, so the reveal lands in a panel that cannot be seen.
- A cancelled turn shows its unfinished assistants or the Coordinator as Idle or Done, or a Stopped row has no press action.
- A page error is logged, or the page overflows sideways.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
