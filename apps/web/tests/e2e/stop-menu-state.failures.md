# Stop menu state failure inventory

Written before the stop menu showed a stop's visit progress and booking as checked items.

- Mark as planned, Mark as visited, Mark as skipped and Mark as booked all carry the same tick, so the
  traveller cannot tell which state the stop is in.
- The current visit progress is shown only as a greyed, disabled item, which reads as "not available"
  rather than "current".
- Assistive technology hears plain menu items and is not told which progress or booking is current.
- Remove sits in the middle of the menu between Add again and Replace place, so a slip from a
  neighbouring item deletes the stop.
- Add again uses the same pencil icon as Edit details.
- After choosing Visited or Booked, the menu still shows the old state when reopened.
- On a phone, a checked item is shorter than 44 px.

Evidence: `stop-menu-state.e2e.mjs` opens a stop's menu at 1440 px and 390 px, reads each item's role,
`aria-checked`, disabled state, tick and position, changes progress and booking, reopens the menu and
screenshots it.
