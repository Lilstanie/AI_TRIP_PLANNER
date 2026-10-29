# Trip home Calendar failure inventory

Public seam: fixture-backed Trip home browser navigation from a trip card into the Calendar drawer,
then into the shared itinerary editor. The journey uses the real workspace, not an isolated component
harness.

1. Calendar opens in month view, or has no Week / Month switch in the default drawer.
2. Week ↔ Month switching clears or shifts the selected Trip day, including across month or year
   boundaries.
3. Trip-local previous / next week navigation leaves the Trip, invents off-Trip dates, or changes the
   selected day unexpectedly. The opening week is the calendar week containing the Trip start, so a
   leading Monday-before-start cell is empty rather than a Trip date.
4. A browser time zone shifts a Trip-local date by one day on the week or month surface.
5. Timed activities are missing from the week time axis, or untimed activities / stays invent a clock
   time instead of staying in an explicit all-day region.
6. Overlapping timed activities cover each other so one cannot be found or activated.
7. Drag-to-reschedule exists, or calendar projection invents start / end times.
8. Two same-named activities are located by label instead of stable identity, so the wrong editor stop
   opens.
9. Clicking a calendar activity does not open the shared itinerary editor on that activity and day.
10. Clicking a month date no longer opens Itinerary on that day or fails to focus the map day.
11. After an edit or Undo, Calendar, home Itinerary, conversation Trip and the map disagree about the
    Plan, selected day or selected activity, including Undo refusing after an untimed stop is given
    a time or failing to put it back in the All day region.
12. Calendar builds a second Plan projection instead of reusing the Trip domain day / booking rules,
    so flights, overnight stays, Ideas or empty days diverge from Itinerary.
13. Acceptance depends on the expanded combined drawer / map state from ticket #797.
14. English / Chinese labels, keyboard activation, phone hit areas or drawer overflow regress.

The repeatable artifact is `trip-home-calendar.e2e.mjs`, which writes screenshots and `summary.json`
under `output/playwright/trip-home-calendar/`.
