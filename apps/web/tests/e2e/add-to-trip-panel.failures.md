# Add to trip panel failure inventory

The agreed seam is the real Trip workspace in a browser at 1440x900 and 390x844, plus 1440x900 in Chinese, with a saved fixture Trip, a second saved fixture Trip that holds a saved place, stubbed place search and details, and the mock edit route. It covers what the traveller sees and the saved plan. It does not establish live-provider behaviour.

- The Add button at the end of a day or in Ideas is missing, or opens the old Add place form with its Place name field and Save as Idea button.
- Add from a day puts the place in Ideas, or add from Ideas puts it on a day, or either shows a preview or a confirm first.
- The panel has no Search, Ideas, Saved and Custom tabs, or shows a Receipt tab, or offers the Ideas tab when it was opened from Ideas.
- Search sends no trip destination, so results start far from the trip.
- A filter (places, stays, restaurants, experiences, events) leaves results that are not of that kind.
- A search with no results adds nothing and says nothing.
- A search that fails offline adds nothing and says nothing, or leaves the panel stuck busy.
- A place that is already on the day replaces or merges with the existing stop instead of adding a second stop.
- A search result with coordinates is added without a saved map match, or a result without coordinates shows a match confirm instead of the stop showing a search box when the lookup fails.
- The Ideas tab lists places that are already scheduled, or scheduling one from it does not move it to the day.
- The Saved tab lists places of the open trip, lists a place twice, lists nothing from the account's other trips, or adding one does not keep its saved map match.
- Custom adds a nameless stop, ignores the typed note or time, or adds a time to an Idea.
- An add from any tab offers no Undo, or Undo leaves the saved plan different from before.
- The panel closes after one add when Keep open is on, or stays open when it is off.
- A running assistant leaves the Add buttons enabled and still sends an edit request.
- Escape or Close asks to discard what was typed.
- On a phone the panel overflows the screen or its controls are under 44 px.
- In Chinese any panel label, tab, filter or notice stays English.
- The old Add place button, Place name field, Save as Idea button and their strings are still present.

Run `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/pw-shim pnpm --filter @trip/web e2e add-to-trip-panel --prod`. The script writes `result.json` and screenshots to `apps/web/output/playwright/add-to-trip-panel/<EVIDENCE_LABEL>/` (default `after`).
