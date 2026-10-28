# Trip home map and phone layout: failure inventory

Written before the code (#769, spec #765). Each line is a way the change could fail.

- The map shows no markers, or markers for the active conversation's trip instead of the trip whose home is open.
- The markers on the Trip home differ in number or position from the markers the workspace map shows for the same trip.
- A trip with no plan shows a map or an empty frame.
- A trip whose stops have no coordinates shows an empty map frame instead of the existing placeholder, or throws.
- The map sits under the content on desktop, or the two columns overflow the viewport.
- The map column is narrower than the map can draw in (a narrow desktop window), clipping the canvas or overflowing the page.
- A very long title or a long tag line pushes the map out of view or off screen.
- The map region has no accessible name, or its name stays in English in the Chinese interface.
- The map adds a control that the workspace map does not have.
- Opening the Trip home changes the active conversation or the stored catalog.
- On a phone, the card opens the conversation instead of the Trip home, or the Trip home shows an empty top bar.
- On a phone, the order is not header, tags, map, or the page scrolls sideways.
- On a phone, the back button leaves the Trip home somewhere other than the Mine tab.
- On a phone, the Trip home survives a rotation or resize to desktop and back with a stale or missing map.
- A trip deleted while its home is open leaves the map standing.
- The page throws, or the browser console logs an error, on any of these paths.

Run `DATA_MODE=mock pnpm --filter @trip/web e2e trip-home-map --prod`. The browser catalog holds a Sydney
trip with two located stops, a Sydney trip with a stop that has no place, and a trip whose destination
cannot be located, all local, with place lookups answered by routes the script installs. The script drives
the Trips page at 1440×1000 and 900×900, a phone at 390×844 and 360×740, and the Chinese interface, and
writes screenshots and `summary.json` under `output/playwright/trip-home-map/`.
