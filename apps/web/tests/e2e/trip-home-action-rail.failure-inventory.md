# Trip home action rail failure inventory

The E2E journey must fail when any of these user-visible outcomes regress:

1. A Trip with more than one linked Chat lists only one Chat or another Trip's Chat.
2. Opening a Chat replaces Trip home, removes the action rail, or requires returning through global navigation.
3. Returning from a Trip Chat lands somewhere other than that Trip home.
4. Sending from the Trip home creates a separate Trip, links the Chat elsewhere, or reuses a non-empty Chat.
5. Any action card navigates away from Trip home.
6. Two action drawers can be open at once, or a second card does not replace the first drawer.
7. Itinerary loses the Trip's stops or exposes another Trip's plan.
8. Ideas omits unscheduled activities.
9. Bookings omits booked activities.
10. Trip preferences opens the global preference surface or edits another Trip.
11. Calendar opens the global calendar, shows another Trip's month, or allows date-range editing.
12. Choosing a calendar day leaves the Calendar drawer instead of opening Itinerary and focusing that day on the map.
13. Close, Escape, or outside press fails to close the drawer.
14. Closing a drawer fails to restore focus to the action card that opened it.
15. The desktop drawer covers the main Chat column instead of the right rail.
16. The phone drawer does not fill the screen.
17. Phone layout puts the composer before the action rail or creates horizontal overflow.
18. English or Chinese labels, keyboard use, reduced motion, or a narrow viewport break the journey.
19. Browser console or page errors occur during the journey.
20. A suggestion ignores the current Plan, opens an unlinked Chat, or loses its prompt.
21. Suggestion dismissal does not survive reload, affects another Trip, or survives a changed Plan.

22. Returning from a newer Chat reloads the Trip's older snapshot, so action drawers lose updates.
23. A desktop split handle changes its value without changing the actual Chat/map widths.
24. The test measures a newly mounted suggestion before its stored dismissal state is ready.
25. A reload's pending blank-Chat persistence is mistaken for a Trip-entry mutation.

The repeatable evidence is `trip-home-action-rail.e2e.mjs`, which seeds local fixture data and writes
screenshots plus `summary.json` under `output/playwright/trip-home-action-rail/`.
