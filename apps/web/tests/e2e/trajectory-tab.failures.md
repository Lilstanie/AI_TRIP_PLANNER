# Trajectory tab on desktop failure inventory

Written before the code (TP-72, #668). Each line is a way the tab could fail; the browser journey must distinguish them.

- The chat column has no "Conversation / Trajectory" tabs, the tabs are not a tablist with `aria-selected`, or the Conversation tab is not selected at first.
- Opening the Trajectory tab leaves the conversation stream visible, or returning to Conversation loses the stream's scroll position or its open thinking rows.
- The ledger is empty or missing although the chat has turns, or it shows a turn for the welcome message.
- A traveller message does not start its own turn, or two messages share one turn, or the turn count differs from the traveller messages sent.
- The turn lacks a User record with the traveller's words, or it comes after the specialists' work.
- The dispatch assignments are missing, show the specialist id instead of its name, carry no icon, or appear out of event order.
- A specialist's tool calls are not nested under its own assignment (they sit under another specialist, outside the turn, or before the assignment).
- The conflict check is missing, is not its own Tool record, or does not name the specialist it sends back.
- The revision round is not its own step, or its assignment and tool calls land in the first step.
- A revision check hides whether the revision was kept or discarded.
- The turn does not end with the reply as an Assistant record, or the reply is attributed to the wrong assistant (a mentioned specialist's reply shown as the Coordinator's).
- A failed assignment or failed tool call is not marked failed (`data-error`), or a successful one is.
- Records carry a token count, a duration, a clock time or an invented elapsed value anywhere in the ledger or the inspector.
- The timeline overview has no lane per record type, orders records by anything but event order, or labels spans with durations.
- Selecting a record does not open its details, the details omit the assignment objective or the tool result, or closing them leaves the selection.
- Searching the ledger does not narrow it to matching records, or an unmatched query leaves rows behind.
- Two turns collapse into one after a reload, or the earlier turns are missing after a reload.
- The ledger does not follow the newest record while a reply streams, still follows after the traveller scrolled up, or a running assignment is shown as finished.
- A cancelled turn shows its unfinished assignments as running forever.
- Returning to Conversation after a reply arrived on the Trajectory tab restores the scroll position from before the switch, so the new reply is below the fold.
- English labels appear under the Chinese interface (toolbar, kind tags, step and turn labels, inspector tabs), or Chinese under English.
- A renamed specialist still shows its default name in the ledger.
- The page overflows horizontally or logs a page error, or the ledger stays blank at 1440 px.
- In the chat column at 1440 px the inspector opens beside the ledger and squeezes it to half width, instead of under a full-width ledger.
- The toolbar buttons or the inspector tabs keep the global 36 px pill button style.
- The timeline lane label for Assistant wraps onto two lines and overlaps the next label.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.

## Simple view as the default (TP-111, #735)

Written before the code. Each line is a way the simple trajectory could fail.

- Opening the Trajectory tab shows the full ledger (`[data-trajectory-scroll]`) first instead of the simple list, or shows both.
- A simple row lacks the summary of the traveller's message, the avatars of the specialists that took part, or the result, or the summary shows the reply instead of the message.
- A row's avatars list the Coordinator, repeat a specialist that worked in two rounds, or omit one that only appeared in a revision round.
- The result says Done for a turn with a failed or stopped assignment, says Done while a conflict is still open, or says anything but Working while a request is streaming.
- Expanding a row shows nothing, shows rounds out of order, drops the revision round, or lists assignments under the wrong round or without the specialist's name.
- Expanding one row leaves another expanded, so the selected turn is ambiguous.
- The switch to the full view loses the turn that was expanded: the ledger opens at the top instead of at that turn.
- Switching back to the simple list collapses the row that was open or opens a different one.
- The simple list and the ledger disagree on the number of turns, on the specialists of a turn, or on which turn failed, because they read different data.
- The per-reply summary jump opens the full view, opens the simple list at the wrong turn, or leaves that turn collapsed.
- The team-panel row jump opens the simple list unfiltered, lists turns the specialist took no part in, or loses the "Show all records" chip.
- The tab reopens in the full view after it was closed in the full view.
- The switch has no accessible name, is not keyboard operable, or does not say which view is shown (`aria-pressed`).
- English labels appear in the simple list under the Chinese interface, or Chinese under English.
- A long traveller message pushes the avatars or result off the row at 1440 px, or the page overflows horizontally.
- An empty trajectory shows a switch and a list with no rows instead of its existing empty state.
