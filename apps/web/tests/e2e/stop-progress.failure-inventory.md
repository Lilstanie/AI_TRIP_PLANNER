# Stop progress failure inventory

Before changing production code, the retained browser journey must distinguish these failures:

- A stop can hold zero or multiple progress states; the accepted model must allow exactly one of planned, visited or skipped.
- A traveller cannot choose each state from the stop's existing actions menu, or the chosen state is not visible as readable text.
- Choosing visited or skipped changes the stop's details, note, booking flag, cost, identity or schedule.
- Returning a visited or skipped stop to planned is unavailable or does not clear the prior state.
- An autosaved state is lost after reloading and reopening the saved trip.
- An invalid persisted state causes the whole saved trip to fail parsing instead of being safely handled.
- Controls are unusable at phone width or expose no accessible state/action names.
- Locale changes leave one of the new state labels untranslated.

The E2E uses a retained, deterministic local trip fixture and no live providers. The first run is
expected to fail before implementation, establishing that the behavior is absent.
