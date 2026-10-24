# Reply summary opens its turn in the trajectory failure inventory

Written before the code (TP-77, #673). Each line is a way the summary jump could fail; the browser journey must distinguish them.

- A finished reply's summary line ("协调员 + 3 位专家 · 2 轮") is plain text, not a button, or has no accessible name.
- Pressing the summary expands or collapses the Think row instead of opening the trajectory, or pressing the Think title no longer toggles the row.
- Pressing the summary opens the trajectory at the top, at the first turn, or at the last turn instead of its own reply's turn.
- With three turns, the second reply's summary shows the first or third turn's traveller message in place of the second.
- The first and third replies' summaries do not reach their own turns.
- The jump leaves the Conversation tab (desktop) or the Chat tab (phone) selected.
- The jump keeps a specialist filter set earlier, so the turn's records are missing.
- Enter on the focused summary does nothing.
- A summary pressed after the Trajectory tab was opened and left does nothing the second time.
- The summary is a button nested inside the Think row's `role="button"` line, so assistive technology cannot reach it (nested interactive controls).
- The page scrolls sideways at 390 px or logs a page error.
- Chinese summaries open nothing, or the tab labels are in the wrong language.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
