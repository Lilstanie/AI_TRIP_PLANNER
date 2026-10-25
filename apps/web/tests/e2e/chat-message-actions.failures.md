# Chat layout and message actions failure inventory

Written before the code. Each line is a way the change could fail; the browser journey must distinguish them.

- The Think toggle, the "N subagents" label or a reply's tool-call summary gets a pill border or background, or a taller box than its 24 px row.
- The Conversation and Trajectory tabs keep a filled pill background when selected or not.
- A new chat shows a map panel beside the empty chat.
- The map appears as soon as the page opens, or never appears after the first reply produces a plan.
- The map jumps in with no transition, or the chat width does not shrink to make room.
- Starting a new chat after a plan leaves the map on screen.
- Reply text or the traveller's message cannot be selected.
- No copy button sits under a message, or it copies something other than that message's text.
- The copy button gives no sign that it copied.
- No edit button on the traveller's own message, or the button appears on replies.
- Editing and resending keeps the old reply and the old message in the log.
- Resending an empty message sends anything, or Escape does not leave edit mode.
- Edit and copy stay reachable by keyboard only after hover.
- The 390 px phone shell loses its map tab or scrolls sideways.
- The page logs a page error.
