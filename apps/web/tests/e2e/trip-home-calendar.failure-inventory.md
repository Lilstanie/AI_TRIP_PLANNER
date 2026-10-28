# Trip home Calendar failure inventory

The confirmed browser seam mounts the exported `TripHomeCalendar` with a real Trip Plan and uses
its public date-selection callback. Parent-owned drawer and map behavior stays in the existing Trip
home action-rail journey.

1. A date outside the current Trip can be activated or exposes a stale Trip activity.
2. A Stop, Idea, flight or stay is placed on the wrong date.
3. A stay covers its checkout date or misses an overnight date.
4. A return flight is omitted or shown on its departure date instead of its return date.
5. More than one Stop on a date loses an activity or its accessible date label.
6. English or Chinese dates, month headings or category labels are unreadable.
7. A keyboard user cannot reach and activate a Trip date.
8. The selected day is not exposed through the documented selected-day state.
9. A 375px viewport, narrow desktop drawer, 520/521px or 1000/1001px crossing creates horizontal
   overflow or hides date content.
10. Calendar offers date-range editing, month navigation away from the Trip, or unrelated Trips.
11. Date cells lose visible focus, text contrast or minimum phone hit areas.

The repeatable artifact is `trip-home-calendar.e2e.mjs`, which writes screenshots and `summary.json`
under `output/playwright/trip-home-calendar/`.
