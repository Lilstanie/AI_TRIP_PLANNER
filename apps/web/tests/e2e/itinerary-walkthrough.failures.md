# Itinerary walkthrough: failure inventory

Written before the script (#751, spec #743). Each line is a way the whole interaction could fail even when the per-ticket scripts pass.

- A drag within a day, to another day or onto the ideas chip works alone but leaves numbers, times, Legs or the saved plan stale for the next action in the same journey.
- Undo after a drag, a menu action, a day action or an add restores something other than the plan from just before it, because an earlier action left state behind.
- Any itinerary action opens a confirm dialog, a preview, a draft banner or a discard question.
- A Stop menu item, a Day menu item or an Itinerary menu item is missing, mislabelled, mis-ordered or has no accessible name at desktop, on the phone or in Chinese.
- Edit title and Add note appear on the Day menu before the plan can store them.
- An editor opens as a sheet or a page instead of a popover on the row.
- Add to trip panel opened from a day adds to Ideas, opened from the ideas chip does not show the Ideas tab, or a tab (Search, Ideas, Saved, Custom) adds nothing.
- A Leg shows no distance after an edit moved its stops, or shows the distance of the old neighbours.
- The Directions link points at the old neighbours after a move, or loses its coordinates.
- A Show distances switch still renders.
- An Ideas section is still rendered.
- A running phone viewport cannot start a drag by long press, or a quick swipe starts one instead of scrolling.
- Chinese labels are missing on a menu, the panel, the switch or the Directions link.
- A drag in the walkthrough aims at a point outside the viewport, which no finger can reach, so a drop passes in the test and cannot be made by a person.
- A page error, a console error or an unexpected dialog appears anywhere in the journey.
- The run leaves no screenshots or no `result.json`, or the result says passed while a check failed.
