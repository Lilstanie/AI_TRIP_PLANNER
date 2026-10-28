# Day menu and itinerary menu: failure inventory

Written before the code (#750, spec #743). Each line is a way the feature could fail. The agreed seam is the real Trip workspace in a browser at 1440x1500 with a mouse and at 390x844 with touch, a saved fixture Trip with one stay and the saved plan in local storage. It covers what the traveller sees and the saved plan.

## Stored on the plan

- Joey approved a `packages/shared` change: an optional `dayNotes` map on `TripPlan`, keyed by day number, holding a title and a note. Older saved plans without it no longer parse, or a malformed key or an over-long title or note is accepted.

## Day menu

- The menu has no accessible name, or its items are reachable only with a mouse.
- Add day before and Add day after do not lengthen the trip: the saved end date or the Day strip still shows the old length.
- Add day before Day 1 moves every stop one day later by changing the dates, so a booked stay or flight lands on a different calendar date.
- Add day after the last day leaves the saved stay without a night or the night count stale.
- Add day in the middle leaves stops on the wrong day, or the stay does not grow by one night and its cost does not follow.
- Add day past the trip dates is refused, or extends the dates without a new empty day to put stops on.
- Clear day on an empty day offers an item that does nothing and records an empty Undo.
- Clear day removes stops from another day, removes the stay or a flight of that day, or leaves Legs and arrival times of the removed stops.
- Remove day on the only day leaves a trip with no day, or a trip whose end date is before its start.
- Remove day leaves stops of the later days on their old day numbers, or leaves the dates unchanged.
- Remove day on a day with a flight silently drops the flight.
- Remove day on a stay that would end up with no night silently drops the stay.
- Any of the day actions asks "are you sure" or opens a dialog.
- A day action shows no Undo, or Undo restores the stops but not the dates, the stay or the day numbers.
- A day action works while the assistant is running or another edit is being checked.
- After a day action the selected day points past the last day, or the Day strip and the map disagree.

## Day title and note

- Edit title and Add note are missing from the day menu, or still absent once the plan can store them.
- Saving opens a dialog or a sheet or page instead of a small form in place, or needs a second confirmation.
- Escape in the form saves instead of cancelling.
- Saving an empty or blank title or note leaves an empty entry in the saved plan instead of removing it.
- A title or note longer than the limit is saved or silently cut without the form saying so.
- The saved title or note is not shown on the day, or shows on another day.
- The note item still says Add note once a note exists.
- Undo after saving restores the text but not the plan, or has no Undo.
- Add day before or after, or Remove day, leaves titles and notes on the old day numbers, or keeps the note of a removed day.
- Clear day removes the title or note of the day.
- A title or note does not survive a reload.
- A title or note is lost when the assistant replans and returns a plan without them.
- Replacing the plan counts as having no direct edits, so a plan with only a note is replaced without the usual warning.

## Day map

- The button is missing, has no accessible name, or does not change which day the map shows.
- On a phone or narrow layout it changes the selected day but leaves the itinerary on screen instead of the map.
- A day with no located Stops shows a blank map without a way back.

## Itinerary menu

- The menu is absent, unnamed, or lists items for single stops.
- Move all events to ideas drops stops instead of keeping them as Ideas, or leaves their times and day numbers on the Ideas.
- Move all events to ideas with nothing scheduled still records an Undo.
- Remove all scheduled events also removes Ideas, the stay or the flights.
- Remove all scheduled events needs a confirmation.
- Undo after either bulk action restores only some stops, or the wrong order.

## Persistence and revisions

- The saved plan does not change after a day action, or changes only in memory and is lost on reload.
- A day action does not land as one plan revision (the edit version does not move by one), so replanning would not build on it.
- Undo does not restore the exact saved plan from before the action.
- After a day action that changes the dates, the Brief draft keeps the old start and end, so the next replan from the Brief drops the added day.
- Add day after the last day leaves the view on the old last day.

## Labels

- A new label has no Chinese translation, or the Chinese accessible name differs from the visible label.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e day-menus --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/day-menus/<EVIDENCE_LABEL>/` (default `after`).
