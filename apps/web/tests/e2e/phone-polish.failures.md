# Phone polish: failure inventory

Written before the change, from fixture-mode screenshots at 390x844 (light and dark). Joey asked for a
big visual refresh of the phone UI and chose (2026-10-30) a sideways row of Where, When, Who and Budget
above the composer on a new chat. Each line is a way the change could fail.

- A new phone chat shows no Where, When, Who and Budget chips, or they appear in the top bar instead of
  above the composer.
- Tapping a chip opens nothing, or saving the editor leaves the chip showing its empty label.
- Saving a chip makes the row jump back into the top bar before the first message is sent.
- After the first plan the row stays above the composer instead of leaving with the blank state.
- The chip row or the suggestion row makes the page scroll sideways at 360 px.
- The tab bar still touches both screen edges, or the selected tab has no filled background.
- Settings opens as a centred card with margins instead of a sheet anchored to the bottom edge.
- Mine's chats and the Trip home actions stay as separate cards instead of one grouped list each.
- In the dark theme a new card keeps a light surface.
- At 1440 px the top-bar fact chips disappear or the phone tab bar shows.
- In Chinese a chip label wraps onto two lines.

Added 2026-10-31 from Joey's iPhone screenshots:

- Mine's 行程 and 聊天 headings stack one character per line beside the New action.
- Tapping the phone chat title opens Trip details inside a stretched top bar, cut off at the top,
  instead of a sheet above the tab bar.
- A Trip details or fact sheet hides its last row under the floating tab bar.
- Swiping up or down on a chat drags the whole page instead of only the message list.
