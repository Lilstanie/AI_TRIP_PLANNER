# Trip panel head failure inventory

Written before the repeated trip line was removed from the top of the trip panel.

- With the Trip open, the panel starts with "Lisbon · 10–13 Mar 2027 · 2 travellers" while the top
  bar chips already show the same destination, dates and travellers.
- On the phone the same line repeats under the trip page title and its fact chips.
- Without that line, the open items badge and the itinerary menu float over an empty strip or cover
  the budget figures.
- The budget line wraps under the badge or the menu at a narrow panel width.
- The itinerary menu sits on a different line from the budget figures.

Evidence: `trip-panel-head.e2e.mjs` records the first row of the panel at desktop, narrow and phone
widths and screenshots each one.
