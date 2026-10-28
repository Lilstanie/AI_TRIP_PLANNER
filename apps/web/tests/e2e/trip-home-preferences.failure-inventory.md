# Trip home preferences failure inventory

The browser journey must fail when any of these outcomes regress:

1. Trip preferences has no Save or Replan action.
2. Editing writes to browser storage before Save, or Save loses a change on reload.
3. Saving or replanning changes the open Trip, linked Chat, or Plan unexpectedly.
4. Replan omits the saved preference or submits another Trip's Brief.
5. English or Chinese controls, drawer focus restoration, or a narrow layout break the journey.
6. Browser console or page errors occur.

The repeatable journey seeds only local browser fixtures, writes screenshots and `summary.json` under
`output/playwright/trip-home-preferences/`, and uses no live provider.
