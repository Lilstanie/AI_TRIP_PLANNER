# Team panel opens the filtered trajectory failure inventory

Rewritten before the code (TP-75, #671). It replaces the #634 inventory, whose press expanded thinking rows. Each line is a way the press could fail; the browser journey must distinguish them.

- A card for an involved specialist has no button, or its button has no accessible name.
- A "not involved" or "idle" card exposes a button or any other action.
- Pressing a specialist leaves the panel open, or leaves the Conversation tab selected.
- Pressing a specialist opens the Thinking process rows, as before.
- The trajectory shows records of other specialists, or the traveller's message, instead of only that specialist's records.
- The Coordinator filter shows a specialist's assignment, or hides the Coordinator's dispatch and reply.
- A conflict check that names the pressed specialist is missing, or a check that names another one is shown.
- The filter has no visible name of the specialist and no control to clear it, or clearing it leaves records hidden.
- Pressing a second specialist adds to the first filter instead of replacing it.
- Switching to Conversation and back keeps a stale filter the traveller cleared, or drops one they did not clear.
- Pressing while a turn is running shows a frozen trajectory instead of one that follows the live records.
- Pressing a specialist while the Map is showing (narrow desktop Map view) leaves the chat hidden, so the trajectory cannot be seen.
- On a phone the sheet cards of involved specialists have no action, or the sheet no longer opens.
- A cancelled turn shows its unfinished assistants or the Coordinator as Idle or Done.
- A page error is logged, or the page overflows sideways.

The E2E runs in mock data mode with no keys. The first run is expected to fail before implementation.
