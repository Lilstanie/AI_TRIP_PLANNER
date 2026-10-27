# Instant itinerary edits failure inventory

The agreed seam is the real Trip workspace in a browser at 1440x900 and 390x844 with a saved fixture Trip, stubbed place search and details, and the mock edit route. It covers what the traveller sees and the saved plan. It does not establish live-provider behaviour.

Each edit kind below is checked for three things: it lands without a confirm, the saved plan changes, and Undo restores the saved plan.

- Choosing a search result in Add place shows a form with Day, Start time, End time and an Add stop button instead of putting the place in the plan.
- Add place has no way to take a custom name and add it at once, or to park a place as an Idea, without the preview form.
- A suggested slot on a day whose last stop ends late wraps past midnight and is accepted as an early-morning stop, or the add fails with no notice.
- Adding a place that is already on the day replaces or merges with the existing stop instead of adding a second stop.
- Search with no results leaves the Add place form open with no notice, or adds nothing and says nothing.
- Closing a half-filled time, details, note, schedule, replace-place or Add place form with Cancel, Escape or the close control opens a Discard changes? dialog.
- Switching to another day with a half-filled form leaves an Unfinished trip edits entry with Continue editing buttons.
- A form that is closed after a failed save still shows a Draft changed since you started editing notice, or refuses Save until Use latest trip and retry is pressed.
- A time, details, note, move, schedule-an-Idea, remove, replace-place or add edit applies but offers no Undo, or the Undo leaves the saved plan different from before the edit.
- An Undo of a drop, a day move or a removal restores the stop but not its day, times or order.
- While an assistant turn is running, a stop time, a stop menu item, Add place or a drag still sends an edit request instead of being refused.
- Closing a form after a failed save drops the typed values before the traveller can try again.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e instant-edits --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/instant-edits/<EVIDENCE_LABEL>/` (default `after`).
