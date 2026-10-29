# Trip fact editors failure inventory

Public seam: fixture browser journey through Trip home, visible modal controls, reload and linked Chat switching; persisted catalog and intercepted planning requests are boundary evidence. Confirmed by #788/#793.

- Home facts are missing, inert, incorrectly named or duplicate preferences.
- Destination changes dates, party, budget, preferences, another Trip or Settings.
- Dates overwrite destination, party, budget or preferences; incomplete ranges save.
- Traveller changes lose party composition or allow children alone / zero travellers.
- Budget changes lose original currency, display converted totals as AUD, accept invalid amounts or omit the currency estimate explanation.
- Save starts planning, changes the existing Plan, submits twice or loses saved draft on reload.
- Explicit Replan uses stale draft, wrong Trip, wrong currency, or unrelated edited fields.
- Dismiss/Cancel commits unsubmitted edits; phone discard confirmation loses earlier saves.
- Preferences mixes fact editors, drops saved facts or leaks into global Settings.
- Linked old Chat downgrades latest Trip snapshot; changing Trips leaks local editor state.
- Desktop/phone close loses focus, traps it in hidden UI or restores another Trip trigger.
- Phone/tablet/breakpoint/zoom clips editor actions or causes horizontal document overflow.
- Chinese copy is missing, literal English leaks, console errors or external provider calls escape fixture.

Red and green runs retain summary.json plus screenshots under output/playwright/trip-fact-editors/<LABEL>.
